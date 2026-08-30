import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { NetworkStatus } from "@/components/NetworkStatus";

const queryClient = new QueryClient();

const NotFound = lazy(() => import("@/pages/not-found"));
const Home = lazy(() => import("@/pages/Home"));
const Chatbots = lazy(() => import("@/pages/Chatbots"));
const Cases = lazy(() => import("@/pages/Cases"));
const Documents = lazy(() => import("@/pages/Documents"));
const Agents = lazy(() => import("@/pages/Agents"));
const AgentChat = lazy(() => import("@/pages/AgentChat"));
const Forum = lazy(() => import("@/pages/Forum"));
const ForumThread = lazy(() => import("@/pages/ForumThread"));
const Komunitas = lazy(() => import("@/pages/Komunitas"));
const LexBot = lazy(() => import("@/pages/LexBot"));
const Peraturan = lazy(() => import("@/pages/Peraturan"));
const Putusan = lazy(() => import("@/pages/Putusan"));
const Panduan = lazy(() => import("@/pages/Panduan"));
const PanduanDetail = lazy(() => import("@/pages/PanduanDetail"));
const Kursus = lazy(() => import("@/pages/Kursus"));
const KursusDetail = lazy(() => import("@/pages/KursusDetail"));
const Pengacara = lazy(() => import("@/pages/Pengacara"));
const PromoAdvokat = lazy(() => import("@/pages/PromoAdvokat"));
const Layanan = lazy(() => import("@/pages/Layanan"));
const Glosarium = lazy(() => import("@/pages/Glosarium"));
const Kalkulator = lazy(() => import("@/pages/Kalkulator"));
const RisetAI = lazy(() => import("@/pages/RisetAI"));
const TelaahDokumen = lazy(() => import("@/pages/TelaahDokumen"));
const PetaPreseden = lazy(() => import("@/pages/PetaPreseden"));
const PenulisCerdas = lazy(() => import("@/pages/PenulisCerdas"));
const ChatbotBuilder = lazy(() => import("@/pages/ChatbotBuilder"));
const EbookBuilder = lazy(() => import("@/pages/EbookBuilder"));
const Harga = lazy(() => import("@/pages/Harga"));
const Masuk = lazy(() => import("@/pages/Masuk"));
const Profil = lazy(() => import("@/pages/Profil"));
const IntelijenRegulasi = lazy(() => import("@/pages/IntelijenRegulasi"));
const AdvOkatOS = lazy(() => import("@/pages/AdvOkatOS"));
const AkademiAdvokat = lazy(() => import("@/pages/AkademiAdvokat"));
const KlinikPHI = lazy(() => import("@/pages/KlinikPHI"));
const StudioOpini = lazy(() => import("@/pages/StudioOpini"));
const KlinikPKPU = lazy(() => import("@/pages/KlinikPKPU"));
const PerpustakaanHukum = lazy(() => import("@/pages/PerpustakaanHukum"));
const LegalOps = lazy(() => import("@/pages/LegalOps"));
const VaultDokumen = lazy(() => import("@/pages/VaultDokumen"));
const BimTek = lazy(() => import("@/pages/BimTek"));
const KlinikPerlindungan = lazy(() => import("@/pages/KlinikPerlindungan"));
const FloatingLexBot = lazy(() =>
  import("@/components/FloatingLexBot").then(({ FloatingLexBot }) => ({
    default: FloatingLexBot,
  })),
);

function RouteFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status" aria-live="polite">
        <span className="h-4 w-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        Memuat halaman...
      </div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/agentic-chatbots" component={Chatbots} />
        <Route path="/agents" component={Agents} />
        <Route path="/agents/:agentKey" component={AgentChat} />
        <Route path="/cases" component={Cases} />
        <Route path="/documents" component={Documents} />
        <Route path="/layanan" component={Layanan} />
        <Route path="/peraturan" component={Peraturan} />
        <Route path="/kursus" component={Kursus} />
        <Route path="/forum" component={Forum} />
        <Route path="/forum/:id" component={ForumThread} />
        <Route path="/putusan" component={Putusan} />
        <Route path="/pengacara" component={Pengacara} />
        <Route path="/panduan" component={Panduan} />
        <Route path="/panduan/:id" component={PanduanDetail} />
        <Route path="/kursus/:id" component={KursusDetail} />
        <Route path="/komunitas" component={Komunitas} />
        <Route path="/lexbot" component={LexBot} />
        <Route path="/promo" component={PromoAdvokat} />
        <Route path="/glosarium" component={Glosarium} />
        <Route path="/kalkulator" component={Kalkulator} />
        <Route path="/riset-ai" component={RisetAI} />
        <Route path="/telaah-dokumen" component={TelaahDokumen} />
        <Route path="/peta-preseden" component={PetaPreseden} />
        <Route path="/penulis-cerdas" component={PenulisCerdas} />
        <Route path="/chatbot-builder" component={ChatbotBuilder} />
        <Route path="/ebook-builder" component={EbookBuilder} />
        <Route path="/harga" component={Harga} />
        <Route path="/masuk" component={Masuk} />
        <Route path="/profil" component={Profil} />
        <Route path="/intelijen-regulasi" component={IntelijenRegulasi} />
        <Route path="/advokat-os" component={AdvOkatOS} />
        <Route path="/akademi-advokat" component={AkademiAdvokat} />
        <Route path="/klinik-phi" component={KlinikPHI} />
        <Route path="/studio-opini" component={StudioOpini} />
        <Route path="/klinik-pkpu" component={KlinikPKPU} />
        <Route path="/perpustakaan" component={PerpustakaanHukum} />
        <Route path="/legal-ops" component={LegalOps} />
        <Route path="/vault" component={VaultDokumen} />
        <Route path="/bimtek" component={BimTek} />
        <Route path="/klinik-perlindungan" component={KlinikPerlindungan} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
            <Suspense fallback={null}>
              <FloatingLexBot />
            </Suspense>
          </WouterRouter>
          <NetworkStatus />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
