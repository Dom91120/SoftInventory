"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Bascule clair/sombre : pose/retire `data-theme="dark"` sur <html>, persistée
 * en localStorage (relue avant le premier paint par components/boot-script.tsx).
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // L'état initial reflète ce que le boot-script a déjà appliqué.
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    if (next) document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={dark ? "Passer en mode clair" : "Passer en mode sombre"}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sub text-muted transition hover:bg-inset hover:text-strong"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
