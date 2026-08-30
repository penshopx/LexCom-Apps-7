import { dataPutusan, type Putusan } from "./putusan";

export interface GraphNode {
  id: string;
  putusan: Putusan;
  x: number;
  y: number;
  type: "match" | "related";
  topics: string[];
  relevanceScore: number;
  sourceUrl: string;
  sourceStatus: "needs-verification";
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
  type: "shared-issue";
}

const STOPWORDS = new Set([
  "putusan", "tentang", "yang", "dan", "dari", "dalam", "atas", "untuk",
  "dengan", "oleh", "pada", "terkait", "hukum", "perkara", "kasus",
  "sepihak", "tanpa", "indonesia",
]);

const NETWORK_DECISIONS = dataPutusan.filter(
  (putusan) => putusan.jenis === "MA" || putusan.jenis === "MK",
);

function buildOfficialSourceUrl(putusan: Putusan): string {
  if (putusan.jenis === "MK") {
    return "https://www.mkri.id/perkara/persidangan/putusan";
  }

  return `https://putusan3.mahkamahagung.go.id/pencarian/?q=${encodeURIComponent(putusan.nomor)}`;
}

function getTopicsFromText(value: string): string[] {
  const text = value.toLowerCase();
  const topics: string[] = [];
  if (text.includes("phk") || text.includes("pekerja") || text.includes("pesangon") || text.includes("ketenagakerjaan")) topics.push("Ketenagakerjaan");
  if (text.includes("korupsi") || text.includes("tipikor") || text.includes("pengadaan")) topics.push("Korupsi");
  if (text.includes("wanprestasi") || text.includes("sengketa") || text.includes("ganti rugi")) topics.push("Sengketa Perdata");
  if (text.includes("cerai") || text.includes("perkawinan") || text.includes("anak") || text.includes("waris")) topics.push("Hukum Keluarga");
  if (text.includes("fidusia") || text.includes("leasing") || text.includes("kreditur")) topics.push("Jaminan Fidusia");
  if (
    text.includes("pengujian") ||
    text.includes("konstitusionalitas") ||
    text.includes("uud") ||
    text.includes("judicial review") ||
    text.includes("mahkamah konstitusi")
  ) topics.push("Pengujian UU");
  if (text.includes("penipuan") || text.includes("penggelapan") || text.includes("pencemaran") || text.includes("hoaks")) topics.push("Pidana Umum");
  return topics;
}

function getTopics(putusan: Putusan): string[] {
  return getTopicsFromText(`${putusan.pokok_perkara} ${putusan.amar}`);
}

function buildNode(
  putusan: Putusan,
  type: GraphNode["type"],
  relevanceScore: number,
): GraphNode {
  return {
    id: putusan.id,
    putusan,
    x: 0,
    y: 0,
    type,
    topics: getTopics(putusan),
    relevanceScore,
    sourceUrl: buildOfficialSourceUrl(putusan),
    sourceStatus: "needs-verification",
  };
}

export function buildPrecedentGraph(query: string): { nodes: GraphNode[]; edges: GraphEdge[] } {
  if (!query.trim()) return { nodes: [], edges: [] };

  const keywords = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((keyword) => keyword.length > 2 && !STOPWORDS.has(keyword));
  const queryTopics = getTopicsFromText(query);

  const nodesMap = new Map<string, GraphNode>();

  NETWORK_DECISIONS.forEach((putusan) => {
    const text = `${putusan.pokok_perkara} ${putusan.amar} ${putusan.nomor}`.toLowerCase();
    const keywordScore = keywords.reduce(
      (score, keyword) => score + (text.includes(keyword) ? 1 : 0),
      0,
    );
    const topics = getTopics(putusan);
    const topicScore = queryTopics.filter((topic) => topics.includes(topic)).length * 2;
    const relevanceScore = keywordScore + topicScore;

    if (relevanceScore > 0) {
      nodesMap.set(putusan.id, buildNode(putusan, "match", relevanceScore));
    }
  });

  if (nodesMap.size === 0) {
    return { nodes: [], edges: [] };
  }

  const matchedNodes = Array.from(nodesMap.values());

  if (matchedNodes.length > 0) {
    NETWORK_DECISIONS.forEach((putusan) => {
      if (nodesMap.has(putusan.id)) return;

      const topics = getTopics(putusan);
      const sharedTopicCount = matchedNodes.reduce((highest, node) => {
        const shared = node.topics.filter(
          (topic) => topic !== "Pengujian UU" && topics.includes(topic),
        ).length;
        return Math.max(highest, shared);
      }, 0);

      if (sharedTopicCount > 0) {
        nodesMap.set(putusan.id, buildNode(putusan, "related", sharedTopicCount));
      }
    });
  }

  const allNodes = Array.from(nodesMap.values())
    .sort((left, right) => {
      if (left.type !== right.type) return left.type === "match" ? -1 : 1;
      if (right.relevanceScore !== left.relevanceScore) {
        return right.relevanceScore - left.relevanceScore;
      }
      return left.putusan.tanggal.localeCompare(right.putusan.tanggal);
    })
    .slice(0, 10);

  const edges: GraphEdge[] = [];
  for (let i = 0; i < allNodes.length; i++) {
    for (let j = i + 1; j < allNodes.length; j++) {
      const a = allNodes[i];
      const b = allNodes[j];

      const sharedTopics = a.topics.filter((topic) => b.topics.includes(topic));
      const specificTopics = sharedTopics.filter((topic) => topic !== "Pengujian UU");
      const relationshipTopic = specificTopics[0] ?? (
        queryTopics.includes("Pengujian UU") ? sharedTopics[0] : undefined
      );
      if (relationshipTopic) {
        edges.push({
          source: a.id,
          target: b.id,
          label: `Isu hukum sama: ${relationshipTopic}`,
          type: "shared-issue",
        });
      }
    }
  }

  const matches = allNodes.filter((node) => node.type === "match");
  const related = allNodes.filter((node) => node.type === "related");

  matches.forEach((node, i) => {
    if (matches.length === 1) {
      node.x = 50;
      node.y = 50;
    } else {
      const angle = (i / matches.length) * 2 * Math.PI - Math.PI / 2;
      node.x = 50 + 15 * Math.cos(angle);
      node.y = 50 + 15 * Math.sin(angle);
    }
  });

  related.forEach((node, i) => {
    const angle = (i / related.length) * 2 * Math.PI + Math.PI / 4;
    node.x = 50 + 38 * Math.cos(angle);
    node.y = 50 + 38 * Math.sin(angle);
  });

  return { nodes: allNodes, edges };
}
