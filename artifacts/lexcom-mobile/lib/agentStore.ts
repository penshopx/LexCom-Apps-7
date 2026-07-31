/**
 * Lightweight module-level store for communicating selected agent across tabs.
 * Used when tapping an agent card on the Peraturan tab navigates to LexBot.
 */

export interface AgentMeta {
  key: string;
  name: string;
  color: string;
  area: string;
  description: string;
}

export const AGENTS: AgentMeta[] = [
  { key: 'corporate', name: 'Corporate Lawyer AI', color: '#6366f1', area: 'Hukum Korporasi', description: 'Pendirian PT/CV, M&A, tata kelola perusahaan, kontrak bisnis' },
  { key: 'tax', name: 'Tax Lawyer AI', color: '#f59e0b', area: 'Perpajakan', description: 'PPh, PPN, sengketa pajak, transfer pricing, kepatuhan fiskal' },
  { key: 'employment', name: 'Employment Lawyer AI', color: '#10b981', area: 'Ketenagakerjaan', description: 'PHK, pesangon, PKWT/PKWTT, upah minimum, BPJS Ketenagakerjaan' },
  { key: 'immigration', name: 'Immigration Lawyer AI', color: '#06b6d4', area: 'Imigrasi', description: 'Visa, KITAS/KITAP, izin kerja TKA, deportasi, naturalisasi' },
  { key: 'bankruptcy', name: 'Bankruptcy Lawyer AI', color: '#ef4444', area: 'Kepailitan & PKPU', description: 'Kepailitan, PKPU, restrukturisasi utang, perlindungan kreditor' },
  { key: 'securities', name: 'Securities Lawyer AI', color: '#8b5cf6', area: 'Pasar Modal', description: 'IPO, reksa dana, obligasi, kepatuhan OJK, insider trading' },
  { key: 'civilrights', name: 'Civil Rights Lawyer AI', color: '#f97316', area: 'HAM & Hak Sipil', description: 'Pelanggaran HAM, diskriminasi, kebebasan berekspresi, hak privasi' },
  { key: 'criminal', name: 'Criminal Defense Lawyer AI', color: '#64748b', area: 'Hukum Pidana', description: 'Pembelaan tersangka, analisis dakwaan, praperadilan, strategi pembelaan' },
  { key: 'family', name: 'Family Lawyer AI', color: '#ec4899', area: 'Hukum Keluarga', description: 'Perceraian, hak asuh anak, harta gono-gini, waris, adopsi' },
  { key: 'realestate', name: 'Real Estate Lawyer AI', color: '#14b8a6', area: 'Properti & Pertanahan', description: 'SHM/HGB, PPAT, jual beli tanah, sengketa lahan, sertifikasi' },
  { key: 'personalinjury', name: 'Personal Injury Lawyer AI', color: '#eab308', area: 'Cedera & Kecelakaan', description: 'Kecelakaan lalu lintas, malpraktik medis, klaim asuransi Jasa Raharja' },
];

let pendingAgent: string | null = null;

export function setPendingAgent(key: string | null) {
  pendingAgent = key;
}

export function consumePendingAgent(): string | null {
  const a = pendingAgent;
  pendingAgent = null;
  return a;
}
