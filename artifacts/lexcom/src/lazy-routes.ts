import { lazy } from "react";

export const lazyRoutes = [
  { path: "/", component: lazy(() => import("@/pages/Home")) },
  {
    path: "/agentic-chatbots",
    component: lazy(() => import("@/pages/Chatbots")),
  },
  { path: "/agents", component: lazy(() => import("@/pages/Agents")) },
  {
    path: "/agents/:agentKey",
    component: lazy(() => import("@/pages/AgentChat")),
  },
  { path: "/cases", component: lazy(() => import("@/pages/Cases")) },
  { path: "/documents", component: lazy(() => import("@/pages/Documents")) },
  { path: "/layanan", component: lazy(() => import("@/pages/Layanan")) },
  {
    path: "/peraturan",
    component: lazy(() => import("@/pages/Peraturan")),
  },
  { path: "/kursus", component: lazy(() => import("@/pages/Kursus")) },
  { path: "/forum", component: lazy(() => import("@/pages/Forum")) },
  {
    path: "/forum/:id",
    component: lazy(() => import("@/pages/ForumThread")),
  },
  { path: "/putusan", component: lazy(() => import("@/pages/Putusan")) },
  {
    path: "/pengacara",
    component: lazy(() => import("@/pages/Pengacara")),
  },
  { path: "/panduan", component: lazy(() => import("@/pages/Panduan")) },
  {
    path: "/panduan/:id",
    component: lazy(() => import("@/pages/PanduanDetail")),
  },
  {
    path: "/kursus/:id",
    component: lazy(() => import("@/pages/KursusDetail")),
  },
  {
    path: "/komunitas",
    component: lazy(() => import("@/pages/Komunitas")),
  },
  { path: "/lexbot", component: lazy(() => import("@/pages/LexBot")) },
  {
    path: "/promo",
    component: lazy(() => import("@/pages/PromoAdvokat")),
  },
  {
    path: "/glosarium",
    component: lazy(() => import("@/pages/Glosarium")),
  },
  {
    path: "/kalkulator",
    component: lazy(() => import("@/pages/Kalkulator")),
  },
  { path: "/riset-ai", component: lazy(() => import("@/pages/RisetAI")) },
  {
    path: "/telaah-dokumen",
    component: lazy(() => import("@/pages/TelaahDokumen")),
  },
  {
    path: "/peta-preseden",
    component: lazy(() => import("@/pages/PetaPreseden")),
  },
  {
    path: "/penulis-cerdas",
    component: lazy(() => import("@/pages/PenulisCerdas")),
  },
  {
    path: "/chatbot-builder",
    component: lazy(() => import("@/pages/ChatbotBuilder")),
  },
  {
    path: "/ebook-builder",
    component: lazy(() => import("@/pages/EbookBuilder")),
  },
  { path: "/harga", component: lazy(() => import("@/pages/Harga")) },
  { path: "/masuk", component: lazy(() => import("@/pages/Masuk")) },
  { path: "/profil", component: lazy(() => import("@/pages/Profil")) },
  {
    path: "/intelijen-regulasi",
    component: lazy(() => import("@/pages/IntelijenRegulasi")),
  },
  {
    path: "/advokat-os",
    component: lazy(() => import("@/pages/AdvOkatOS")),
  },
  {
    path: "/akademi-advokat",
    component: lazy(() => import("@/pages/AkademiAdvokat")),
  },
  {
    path: "/klinik-phi",
    component: lazy(() => import("@/pages/KlinikPHI")),
  },
  {
    path: "/studio-opini",
    component: lazy(() => import("@/pages/StudioOpini")),
  },
  {
    path: "/klinik-pkpu",
    component: lazy(() => import("@/pages/KlinikPKPU")),
  },
  {
    path: "/perpustakaan",
    component: lazy(() => import("@/pages/PerpustakaanHukum")),
  },
  {
    path: "/legal-ops",
    component: lazy(() => import("@/pages/LegalOps")),
  },
  {
    path: "/vault",
    component: lazy(() => import("@/pages/VaultDokumen")),
  },
  { path: "/bimtek", component: lazy(() => import("@/pages/BimTek")) },
  {
    path: "/klinik-perlindungan",
    component: lazy(() => import("@/pages/KlinikPerlindungan")),
  },
] as const;

export const LazyNotFound = lazy(() => import("@/pages/not-found"));