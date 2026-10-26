"use client";

import { useEffect, useMemo, useState } from "react";
import { SportComplexVisual } from "@/components/platform/SportComplexVisual";
import { getHomeSportTheme } from "@/lib/platform/homeHeroTheme";
import { isCajamarcaLightingTime } from "@/lib/platform/cajamarcaLighting";

export function SportLandingVisual({ sportSlug }: { sportSlug: string }) {
  const theme = useMemo(() => getHomeSportTheme(sportSlug), [sportSlug]);
  const [sceneNight, setSceneNight] = useState(false);

  useEffect(() => {
    const syncLighting = () => setSceneNight(isCajamarcaLightingTime(new Date()));
    syncLighting();
    const intervalId = window.setInterval(syncLighting, 15_000);
    const syncWhenVisible = () => {
      if (document.visibilityState === "visible") syncLighting();
    };
    document.addEventListener("visibilitychange", syncWhenVisible);
    window.addEventListener("focus", syncLighting);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", syncWhenVisible);
      window.removeEventListener("focus", syncLighting);
    };
  }, []);

  return <SportComplexVisual theme={theme} isNight={sceneNight} />;
}
