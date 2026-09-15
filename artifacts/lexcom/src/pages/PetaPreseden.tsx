import { useState, useRef, useCallback } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { copyToClipboard } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Network, Search, Loader2, ExternalLink, ChevronRight, Copy, Check,
  AlertTriangle, X, Link2,
} from "lucide-react";
import { buildPrecedentGraph, type GraphNode, type GraphEdge } from "@/data/peta-helper";
import { type Putusan } from "@/data/putusan";

const EXAMPLE_QUERIES = [
  "Putusan tentang PHK sepihak tanpa pesangon",
  "Tindak pidana korupsi pengadaan barang jasa",
  "Sengketa hak cipta musik Indonesia",
  "Wanprestasi kontrak jual beli tanah",
  "Pencemaran lingkungan oleh korporasi",
  "Judicial review UU di Mahkamah Konstitusi",
];

const PRECEDENT_AGENTS = [
  {
    key: "researcher",
    emoji: "🔬",
    name: "Legal Researcher AI",
    color: "bg-violet-600",
    role: "Temuan Preseden",
    prompt: `Anda adalah Legal Researcher AI Indonesia. Analisis topik hukum berikut dan jelaskan secara konseptual. Graf preseden di antarmuka dibangun secara deterministik dari data katalog lokal, jadi tugas Anda bukan mengarang nomor fiktif melainkan memberikan konteks atas putusan yang ada:
1. **Kaidah/Ratio Decidendi** dari isu ini
2. **Konteks Hukum** yang mendasari (jika ada rujukan lokal, jelaskan relevansinya)
Topik: `,
  },
  {
    key: "criminal",
    emoji: "🛡️",
    name: "Criminal Defense AI",
    color: "bg-slate-600",
    role: "Preseden Pidana",
    prompt: `Anda adalah Criminal Defense AI. Analisis topik ini dari sudut pandang pembelaan pidana. Jika ada kandidat putusan dari katalog lokal, gunakan sebagai ilustrasi:
1. **Strategi pembelaan** atau pendekatan hukum
2. **Implikasi untuk kasus serupa**
Topik: `,
  },
  {
    key: "corporate",
    emoji: "🏢",
    name: "Corporate Lawyer AI",
    color: "bg-blue-600",
    role: "Preseden Bisnis",
    prompt: `Anda adalah Corporate Lawyer AI. Analisis implikasi bisnis dari topik hukum ini. Gunakan kandidat putusan dari katalog lokal (jika ada) sebagai rujukan:
1. **Implikasi bisnis**
2. **Saran praktis** untuk pelaku usaha
Topik: `,
  },
];

interface PrecedentResult {
  key: string;
  emoji: string;
  name: string;
  color: string;
  role: string;
  content: string;
  done: boolean;
  error?: boolean;
}

const JENIS_COLORS: Record<string, string> = {
  MK: "#ef4444",
  MA: "#3b82f6",
};

function formatNodeLabel(p: Putusan) {
  if (p.jenis === "MK") {
    return p.nomor.replace("Putusan MK No. ", "MK ").split("/").slice(0, 2).join("/");
  }
  if (p.jenis === "MA") {
    return p.nomor.replace("Putusan MA No. ", "MA ").replace("Putusan MA (PK) No. ", "MA PK ");
  }
  return p.nomor.replace("Putusan ", "");
}

export default function PetaPreseden() {
  const [query, setQuery] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<PrecedentResult[]>([]);
  const [activeResult, setActiveResult] = useState<string | null>(null);

  const [graphData, setGraphData] = useState<{nodes: GraphNode[], edges: GraphEdge[]}>({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [showMap, setShowMap] = useState(false);

  const [copied, setCopied] = useState<string | null>(null);
  const convIdRef = useRef<number | null>(null);

  const getConvId = useCallback(async () => {
    if (convIdRef.current) return convIdRef.current;
    const res = await fetch("/api/assistant/conversations", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
    });
    const d = await res.json();
    convIdRef.current = d.id;
    return d.id as number;
  }, []);

  const streamResult = useCallback(async (agent: typeof PRECEDENT_AGENTS[0], topic: string, contextNodes: GraphNode[], convId: number, idx: number) => {
    const matchInfo = contextNodes.length > 0
      ? `\nKandidat putusan dari katalog lokal yang terkait topik ini (seluruh isi masih perlu verifikasi manual pada sumber resmi):\n${contextNodes.map(n => `- ${n.putusan.nomor} (${n.metadata.court}, ${n.metadata.year}); isu katalog: ${n.metadata.legalIssues.join(", ")}; status: BELUM DIVERIFIKASI; sumber pemeriksaan: ${n.metadata.officialSourceUrl}`).join('\n')}\nJangan nyatakan nomor, ringkasan, amar, relasi, atau status hukum kandidat sebagai fakta terverifikasi. Jika menyebut kandidat, selalu beri label \"perlu verifikasi\" dan arahkan pengguna ke sumber resmi.`
      : "\n[Tidak ada kandidat putusan spesifik dari katalog lokal untuk topik ini, berikan analisis umum saja]";

    const prompt = `${agent.prompt}${topic}\n${matchInfo}`;
    try {
      const res = await fetch(`/api/assistant/conversations/${convId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: prompt }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          const t = line.startsWith("data: ") ? line.slice(6).trim() : line.trim();
          if (!t || t === "[DONE]") continue;
          try {
            const ev = JSON.parse(t);
            if (ev.type === "content" && ev.content) {
              setResults(prev => prev.map((r, i) => i === idx ? { ...r, content: r.content + ev.content } : r));
            }
            if (ev.type === "error") {
              setResults(prev => prev.map((r, i) => i === idx ? { ...r, done: true, error: true } : r));
              return;
            }
          } catch {}
        }
      }
      setResults(prev => prev.map((r, i) => i === idx ? { ...r, done: true } : r));
    } catch {
      setResults(prev => prev.map((r, i) => i === idx ? { ...r, done: true, error: true } : r));
    }
  }, []);

  const runSearch = async () => {
    if (!query.trim() || isProcessing) return;
    setIsProcessing(true);

    // 1. Build Graph from local catalog
    const graph = buildPrecedentGraph(query);
    setGraphData(graph);
    setSelectedNode(null);
    setShowMap(true);

    // 2. AI processing
    setResults(PRECEDENT_AGENTS.map(a => ({ ...a, content: "", done: false })));
    setActiveResult(PRECEDENT_AGENTS[0].key);

    try {
      const convId = await getConvId();
      await Promise.all(PRECEDENT_AGENTS.map((a, i) => streamResult(a, query, graph.nodes, convId, i)));
    } finally {
      setIsProcessing(false);
    }
  };

  const copyText = (text: string, id: string) => {
    copyToClipboard(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const selectedRelations = selectedNode
    ? graphData.edges
        .filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id)
        .map((edge) => {
          const relatedId = edge.source === selectedNode.id ? edge.target : edge.source;
          return {
            edge,
            node: graphData.nodes.find((node) => node.id === relatedId),
          };
        })
        .filter((relation): relation is { edge: GraphEdge; node: GraphNode } => Boolean(relation.node))
        .slice(0, 3)
    : [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 pt-28 pb-16">
        <div className="max-w-6xl mx-auto px-4">

          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
              <Network className="w-4 h-4" /> Peta Preseden AI
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
              Peta Preseden <span className="text-gradient">Yurisprudensi</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Jaringan kandidat preseden dari katalog lokal, dilengkapi analisis dari tiga perspektif AI.
            </p>
          </div>

          {/* Search */}
          <div className="glass-card rounded-2xl p-5 mb-8">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && runSearch()}
                  placeholder="Masukkan topik hukum atau jenis kasus untuk dipetakan presedennnya..."
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <button
                onClick={runSearch}
                disabled={!query.trim() || isProcessing}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-all"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Network className="w-4 h-4" /> Petakan</>}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLE_QUERIES.map(ex => (
                <button
                  key={ex}
                  onClick={() => setQuery(ex)}
                  className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {results.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

              {/* Precedent Map Visualization */}
              <div className="lg:col-span-2">
                <div className="glass-card rounded-2xl p-5 border border-white/10 sticky top-28">
                  <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                    <Network className="w-4 h-4 text-primary" /> Jaringan Kandidat Perkara
                    {graphData.nodes.length > 0 && (
                      <span className="ml-auto text-[10px] font-normal text-muted-foreground">
                        {graphData.nodes.length} MA/MK
                      </span>
                    )}
                  </h3>

                  <div className="relative h-64 w-full mb-4 bg-black/20 rounded-xl border border-white/5 overflow-hidden">
                    {graphData.nodes.length === 0 && !isProcessing && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                        <Search className="w-8 h-8 text-muted-foreground/30 mb-2" />
                        <p className="text-xs text-muted-foreground">
                          Tidak ada preseden relevan ditemukan di katalog lokal.
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1 max-w-[200px]">
                          AI agent tetap akan mencoba memberikan analisis konseptual secara umum.
                        </p>
                      </div>
                    )}

                    {graphData.nodes.length > 0 && (
                      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {graphData.edges.map((edge, i) => {
                          const sourceNode = graphData.nodes.find(n => n.id === edge.source);
                          const targetNode = graphData.nodes.find(n => n.id === edge.target);
                          if (!sourceNode || !targetNode) return null;
                          return (
                            <g key={i}>
                              <line
                                x1={sourceNode.x} y1={sourceNode.y}
                                x2={targetNode.x} y2={targetNode.y}
                                stroke="#ffffff" strokeWidth="0.3" strokeOpacity="0.2" strokeDasharray="1,1"
                              />
                            </g>
                          );
                        })}
                      </svg>
                    )}

                    {graphData.nodes.map((node, i) => {
                      const isSelected = selectedNode?.id === node.id;
                      const baseColor = JENIS_COLORS[node.putusan.jenis] || "#8b5cf6";
                      return (
                        <AnimatePresence key={node.id}>
                          {(showMap || i === 0) && (
                            <motion.div
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ delay: i * 0.08, type: "spring" }}
                              className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10"
                              style={{ left: `${node.x}%`, top: `${node.y}%` }}
                              onClick={() => setSelectedNode(node)}
                            >
                              <div
                                className={`rounded-xl flex items-center justify-center text-center shadow-lg cursor-pointer transition-all duration-300 ${
                                  isSelected ? "ring-2 ring-primary scale-110 z-20" : "hover:scale-110"
                                }`}
                                style={{
                                  backgroundColor: baseColor + (node.type === "match" ? "30" : "15"),
                                  borderColor: baseColor + (isSelected ? "90" : "40"),
                                  borderWidth: "1px",
                                  width: node.type === "match" ? "4.5rem" : "3.5rem",
                                  height: node.type === "match" ? "4.5rem" : "3.5rem",
                                }}
                              >
                                <span
                                  className="text-foreground leading-tight px-1 font-semibold"
                                  style={{ fontSize: node.type === "match" ? "10px" : "8px" }}
                                >
                                  {formatNodeLabel(node.putusan)}
                                </span>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      );
                    })}

                    {!showMap && isProcessing && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-30">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    )}
                  </div>

                  {selectedNode ? (
                    <div className="mt-4 pt-4 border-t border-white/10 animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full`} style={{ backgroundColor: JENIS_COLORS[selectedNode.putusan.jenis] + "20", color: JENIS_COLORS[selectedNode.putusan.jenis], borderColor: JENIS_COLORS[selectedNode.putusan.jenis] + "50", borderWidth: "1px" }}>
                            {selectedNode.putusan.jenis}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{selectedNode.metadata.court} · {selectedNode.metadata.year}</span>
                        </div>
                        <button onClick={() => setSelectedNode(null)} className="text-muted-foreground hover:text-foreground">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs font-mono text-muted-foreground mb-2">{selectedNode.putusan.nomor}</p>
                      <div className="mb-2 flex flex-wrap gap-1">
                        {selectedNode.metadata.legalIssues.map((issue) => (
                          <span key={issue} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] text-muted-foreground">{issue}</span>
                        ))}
                      </div>
                      <p className="text-sm font-semibold mb-1 line-clamp-2" title={selectedNode.putusan.pokok_perkara}>{selectedNode.putusan.pokok_perkara}</p>
                      <p className="text-xs text-muted-foreground line-clamp-3 mb-3">{selectedNode.putusan.amar}</p>

                      {selectedRelations.length > 0 && (
                        <div className="mb-3 space-y-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Relasi yang dapat dijelaskan
                          </p>
                          {selectedRelations.map(({ edge, node }) => (
                            <button
                              key={`${edge.source}-${edge.target}`}
                              type="button"
                              onClick={() => setSelectedNode(node)}
                              className="flex w-full items-start gap-2 rounded-lg border border-white/10 bg-white/5 p-2 text-left hover:bg-white/10"
                            >
                              <Link2 className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                              <span className="min-w-0">
                                <span className="block truncate text-[10px] text-foreground">{node.putusan.nomor}</span>
                                <span className="block text-[9px] text-muted-foreground">{edge.label}</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-col gap-2">
                        <div className="flex items-start gap-1.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px]">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <p>Kandidat dari katalog lokal. <strong>Perlu verifikasi sumber resmi</strong> untuk memastikan nomor, amar, dan perkembangan setelah putusan.</p>
                        </div>
                        <a
                          href={selectedNode.metadata.officialSourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" /> Buka {selectedNode.metadata.officialSourceName}
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <div className="space-y-1.5 text-xs mb-4">
                        {[
                          { color: JENIS_COLORS.MK, label: "Mahkamah Konstitusi (MK)" },
                          { color: JENIS_COLORS.MA, label: "Mahkamah Agung (MA)" },
                        ].map((item, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="text-muted-foreground">{item.label}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] leading-relaxed text-muted-foreground">
                        Garis menjelaskan isu hukum bersama dari metadata katalog, bukan kutipan atau overruling. Semua node perlu diperiksa manual pada sumber resmi.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Synchronized case list + Agent Results */}
              <div className="lg:col-span-3 space-y-3">
                <div className="glass-card rounded-2xl border border-white/10 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold">Perkara dalam jaringan</h3>
                      <p className="text-[10px] text-muted-foreground">Daftar ini memakai node yang sama dengan peta, diurutkan menurut relevansi.</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{graphData.nodes.length} kandidat</span>
                  </div>
                  {graphData.nodes.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {graphData.nodes.map((node) => (
                        <button key={node.id} type="button" onClick={() => setSelectedNode(node)} className={`rounded-xl border p-3 text-left transition-colors ${selectedNode?.id === node.id ? "border-primary/50 bg-primary/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
                          <div className="mb-1 flex items-center gap-2">
                            <span className="text-[9px] font-bold text-primary">{node.putusan.jenis}</span>
                            <span className="text-[9px] text-muted-foreground">{node.metadata.year}</span>
                            <span className="ml-auto text-[9px] text-amber-300">Perlu verifikasi</span>
                          </div>
                          <p className="truncate text-[10px] font-mono">{node.putusan.nomor}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{node.putusan.pokok_perkara}</p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-muted-foreground">
                      Belum ada perkara MA/MK dengan tautan pemeriksaan resmi yang cocok. Isi katalog belum diverifikasi; coba istilah isu yang lebih spesifik.
                    </div>
                  )}
                </div>
                {results.map((agent, i) => (
                  <motion.div
                    key={agent.key}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="glass-card rounded-2xl overflow-hidden border border-white/10"
                  >
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors"
                      onClick={() => setActiveResult(activeResult === agent.key ? null : agent.key)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl ${agent.color} flex items-center justify-center text-lg`}>
                          {agent.emoji}
                        </div>
                        <div>
                          <p className="text-sm font-bold">{agent.name}</p>
                          <p className="text-[11px] text-muted-foreground">{agent.role}</p>
                          {!agent.done ? (
                            <p className="text-xs text-primary flex items-center gap-1 mt-0.5">
                              <Loader2 className="w-3 h-3 animate-spin" /> Menganalisis...
                            </p>
                          ) : agent.error ? (
                            <p className="text-xs text-red-400 mt-0.5">Gagal</p>
                          ) : (
                            <p className="text-xs text-emerald-400 mt-0.5">✓ Analisis selesai</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {agent.done && !agent.error && (
                          <button onClick={e => { e.stopPropagation(); copyText(agent.content, agent.key); }} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                            {copied === agent.key ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                          </button>
                        )}
                        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${activeResult === agent.key ? "rotate-90" : ""}`} />
                      </div>
                    </div>

                    <AnimatePresence>
                      {activeResult === agent.key && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-white/10"
                        >
                          <div className="p-4 prose prose-invert prose-sm max-w-none">
                            {agent.content ? (
                              <MarkdownRenderer content={agent.content} />
                            ) : (
                              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                <Loader2 className="w-4 h-4 animate-spin" /> Menyusun analisis...
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {results.length === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PRECEDENT_AGENTS.map((agent, i) => (
                <div key={agent.key} className="glass-card rounded-xl p-5 border border-white/10 text-center">
                  <div className={`w-12 h-12 rounded-xl ${agent.color} flex items-center justify-center text-2xl mx-auto mb-3`}>{agent.emoji}</div>
                  <p className="text-sm font-bold mb-1">{agent.name}</p>
                  <p className="text-xs text-muted-foreground">{agent.role}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
