"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Drží obrazovku rozsvícenou (Screen Wake Lock API).
 *
 * V kuchyni je to zásadní — s rukama od těsta se displej odemyká blbě.
 * API zatím neumí každý prohlížeč (hlavně starší iOS), takže je všechno
 * ošetřené a při nedostupnosti se prostě nic nestane.
 */
export function useWakeLock(active: boolean): { supported: boolean; held: boolean } {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const [held, setHeld] = useState(false);
  const supported = typeof navigator !== "undefined" && "wakeLock" in navigator;

  useEffect(() => {
    if (!active || !supported) {
      return;
    }

    let cancelled = false;

    const request = async () => {
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void sentinel.release();
          return;
        }
        sentinelRef.current = sentinel;
        setHeld(true);
        sentinel.addEventListener("release", () => setHeld(false));
      } catch {
        // Prohlížeč může zámek odmítnout (slabá baterie, skrytá záložka).
        setHeld(false);
      }
    };

    void request();

    // Po návratu ze zamčené obrazovky prohlížeč zámek zahodí — je potřeba
    // si o něj říct znovu, jinak displej za chvíli zhasne.
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && sentinelRef.current === null) {
        void request();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      setHeld(false);
      void sentinel?.release().catch(() => undefined);
    };
  }, [active, supported]);

  return { supported, held };
}
