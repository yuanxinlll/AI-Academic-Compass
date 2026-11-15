"use client";

import { useLayoutEffect } from "react";

const storageKey = "academic-compass-theme";

export default function ThemeToggle() {
  useLayoutEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function syncTheme() {
      let saved: string | null = null;
      try { saved = localStorage.getItem(storageKey); } catch { /* Storage may be disabled. */ }
      document.documentElement.dataset.theme =
        saved === "light" || saved === "dark" ? saved : media.matches ? "dark" : "light";
    }
    function onStorage(event: StorageEvent) {
      if (event.key === storageKey || event.key === null) syncTheme();
    }
    syncTheme();
    media.addEventListener("change", syncTheme);
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", syncTheme);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  function toggle() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(storageKey, next); } catch { /* Keep this session usable. */ }
  }

  return (
    <button type="button" className="compass-theme" onClick={toggle} aria-label="Switch between light and dark ocean themes">
      <span className="compass-to-dark">Night ocean</span>
      <span className="compass-to-light">Day ocean</span>
    </button>
  );
}
