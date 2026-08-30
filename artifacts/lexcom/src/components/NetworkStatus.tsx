import { useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, WifiOff } from "lucide-react";

export function NetworkStatus() {
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== "undefined" && !navigator.onLine,
  );
  const [hasReconnected, setHasReconnected] = useState(false);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof window.setTimeout> | undefined;

    const handleOffline = () => {
      setIsOffline(true);
      setHasReconnected(false);
    };

    const handleOnline = () => {
      setIsOffline(false);
      setHasReconnected(true);
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      reconnectTimer = window.setTimeout(() => setHasReconnected(false), 3500);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
    };
  }, []);

  const retryConnection = () => {
    if (navigator.onLine) {
      window.location.reload();
    }
  };

  return (
    <>
      {isOffline && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 px-6 backdrop-blur-md"
          role="alert"
          aria-live="assertive"
        >
          <div className="w-full max-w-md text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-primary/25 bg-primary/10 text-primary shadow-lg shadow-primary/10">
              <WifiOff className="h-9 w-9" aria-hidden="true" />
            </div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Mode offline
            </p>
            <h1 className="font-display text-3xl font-bold text-foreground">
              Koneksi terputus
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
              LexCom tidak dapat terhubung ke internet. Periksa jaringan Anda,
              lalu coba lagi. Konten yang sudah dimuat mungkin tetap tersedia
              setelah koneksi pulih.
            </p>
            <button
              type="button"
              onClick={retryConnection}
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:shadow-primary/30 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Coba lagi
            </button>
            <p className="mt-4 text-xs text-muted-foreground">
              Halaman akan kembali otomatis saat jaringan tersedia.
            </p>
          </div>
        </div>
      )}

      {hasReconnected && !isOffline && (
        <div
          className="fixed left-1/2 top-4 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-300 shadow-lg backdrop-blur-md"
          role="status"
          aria-live="polite"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Koneksi kembali
        </div>
      )}
    </>
  );
}