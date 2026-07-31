import { Router, type IRouter } from "express";
import { db, documentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { batchProcess, isRateLimitError } from "@workspace/integrations-openai-ai-server/batch";

const router: IRouter = Router();

/**
 * Wraps a single OpenAI call with automatic retry + exponential backoff on
 * rate-limit errors (429). Uses the shared batchProcess utility so the retry
 * behaviour stays consistent across all agents.
 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  const [result] = await batchProcess(
    [null as null],
    () => fn(),
    { concurrency: 1, retries: 5, minTimeout: 1000, maxTimeout: 30000 },
  );
  return result!;
}

const DOCUMENT_SYSTEM_PROMPTS: Record<string, string> = {
  gugatan: "Anda adalah pengacara Indonesia yang ahli membuat surat gugatan. Buat dokumen gugatan yang formal, lengkap, dan sesuai format pengadilan Indonesia.",
  jawaban: "Anda adalah pengacara Indonesia yang ahli membuat surat jawaban gugatan. Buat dokumen jawaban yang formal dan sesuai format hukum acara Indonesia.",
  replik: "Anda adalah pengacara Indonesia yang ahli membuat replik. Buat dokumen replik yang formal dan sesuai format hukum acara Indonesia.",
  duplik: "Anda adalah pengacara Indonesia yang ahli membuat duplik. Buat dokumen duplik yang formal dan sesuai format hukum acara Indonesia.",
  surat_kuasa: "Anda adalah pengacara Indonesia yang ahli membuat surat kuasa. Buat surat kuasa yang sah, formal, dan sesuai hukum Indonesia.",
  kontrak: "Anda adalah pengacara Indonesia yang ahli membuat kontrak dan perjanjian bisnis. Buat kontrak/perjanjian yang komprehensif, seimbang, dan sesuai hukum Indonesia.",
  perjanjian: "Anda adalah pengacara Indonesia yang ahli membuat perjanjian. Buat perjanjian yang komprehensif dan sesuai hukum Indonesia (KUHPerdata).",
  default: "Anda adalah pengacara Indonesia yang ahli membuat dokumen hukum. Buat dokumen yang formal, lengkap, dan sesuai dengan hukum Indonesia yang berlaku.",
};

router.get("/documents", async (req, res) => {
  try {
    const userId = req.user?.id;
    let docs;
    if (userId) {
      docs = await db.select().from(documentsTable).where(eq(documentsTable.userId, userId));
    } else {
      docs = await db.select().from(documentsTable);
    }
    res.json(docs);
  } catch (err) {
    req.log.error({ err }, "Failed to list documents");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/documents", async (req, res) => {
  try {
    const { title, documentType, content } = req.body;
    if (!title || !documentType || !content) {
      res.status(400).json({ error: "title, documentType, and content are required" });
      return;
    }
    const userId = req.user?.id ?? null;
    const [doc] = await db
      .insert(documentsTable)
      .values({ title, documentType, content, userId })
      .returning();
    res.status(201).json(doc);
  } catch (err) {
    req.log.error({ err }, "Failed to create document");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/documents/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [doc] = await db.select().from(documentsTable).where(eq(documentsTable.id, id));
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    res.json(doc);
  } catch (err) {
    req.log.error({ err }, "Failed to get document");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/documents/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [deleted] = await db.delete(documentsTable).where(eq(documentsTable.id, id)).returning();
    if (!deleted) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete document");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/documents/generate", async (req, res) => {
  try {
    const { documentType, description, parties, details } = req.body;
    if (!documentType || !description) {
      res.status(400).json({ error: "documentType and description are required" });
      return;
    }

    const systemPrompt = DOCUMENT_SYSTEM_PROMPTS[documentType] ?? DOCUMENT_SYSTEM_PROMPTS.default;

    const userPrompt = `Buat dokumen hukum dengan detail berikut:
Jenis Dokumen: ${documentType}
Deskripsi: ${description}
${parties ? `Pihak-pihak: ${parties}` : ""}
${details ? `Detail tambahan: ${details}` : ""}

Buat dokumen yang lengkap dengan format profesional, termasuk:
- Header/kop dokumen
- Nomor/tanggal dokumen
- Identitas pihak-pihak
- Isi/substansi dokumen
- Penutup dan tanda tangan`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullContent = "";

    // Stream creation is retried on rate limit before any bytes are sent to
    // the client, so the SSE channel stays clean if the first attempt hits 429.
    let stream;
    try {
      stream = await withRetry(() =>
        openai.chat.completions.create({
          model: "gpt-5.2",
          max_completion_tokens: 8192,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          stream: true,
        }),
      );
    } catch (err) {
      req.log.error({ err }, "Document generation stream failed");
      const message = isRateLimitError(err)
        ? "Batas permintaan AI tercapai. Silakan coba lagi dalam beberapa detik."
        : "Gagal memulai pembuatan dokumen. Silakan coba lagi.";
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
      return;
    }

    try {
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          fullContent += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }
    } catch (err) {
      req.log.error({ err }, "Document generation stream interrupted");
      const message = isRateLimitError(err)
        ? "Batas permintaan AI tercapai saat pembuatan dokumen. Silakan coba lagi."
        : "Koneksi terputus saat pembuatan dokumen. Silakan coba lagi.";
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
      return;
    }

    res.write(`data: ${JSON.stringify({ done: true, fullContent })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "Failed to generate document");
    const message = isRateLimitError(err)
      ? "Batas permintaan AI tercapai. Silakan coba lagi dalam beberapa detik."
      : "Internal server error";
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  }
});

export default router;
