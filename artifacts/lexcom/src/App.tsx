import { lazy, Suspense, useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { lazyRoutes, LazyNotFound } from "@/lazy-routes";

const queryClient = new QueryClient();

const FloatingLexBot = lazy(() =>
  import("@/components/FloatingLexBot").then(({ FloatingLexBot }) => ({
    default: FloatingLexBot,
  })),
);
const NetworkStatus = lazy(() =>
  import("@/components/NetworkStatus").then(({ NetworkStatus }) => ({
    default: NetworkStatus,
  })),
);
const Toaster = lazy(() =>
  import("@/components/ui/toaster").then(({ Toaster }) => ({
    default: Toaster,
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
        {lazyRoutes.map(({ path, component }) => (
          <Route key={path} path={path} component={component} />
        ))}
        <Route component={LazyNotFound} />
      </Switch>
    </Suspense>
  );
}

function DeferredGlobalUi() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <NetworkStatus />
      <Toaster />
    </Suspense>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
          <Suspense fallback={null}>
            <FloatingLexBot />
          </Suspense>
        </WouterRouter>
        <DeferredGlobalUi />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
