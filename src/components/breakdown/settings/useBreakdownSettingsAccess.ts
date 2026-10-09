"use client";

import { useEffect, useState } from "react";

// Whether the signed-in person may open "Cài đặt Bóc tách" (Admin always; other
// roles only when Admin switched them on). `loaded` is false until the server answers.
export function useBreakdownSettingsAccess() {
  const [state, setState] = useState<{ loaded: boolean; canOpen: boolean; allowedRoles: string[] }>({ loaded: false, canOpen: false, allowedRoles: [] });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/breakdown-settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { canOpen: boolean; allowedRoles: string[] } | null) => {
        if (cancelled) return;
        setState({ loaded: true, canOpen: !!data?.canOpen, allowedRoles: data?.allowedRoles ?? [] });
      })
      .catch(() => {
        if (!cancelled) setState({ loaded: true, canOpen: false, allowedRoles: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
