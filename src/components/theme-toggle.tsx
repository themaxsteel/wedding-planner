"use client";

import * as React from "react";
import { MoonIcon, SunIcon } from "@phosphor-icons/react/dist/ssr";
import { Button } from "./ui/primitives";

const KEY = "wfp-theme";

/**
 * Skrip ini disisipkan sebelum React hydrate supaya halaman tidak sempat
 * berkedip putih ketika user memilih mode gelap.
 */
export const themeBootstrapScript = `
(function(){try{
  var t = localStorage.getItem("${KEY}");
  if (!t) t = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  if (t === "dark") document.documentElement.classList.add("dark");
}catch(e){}})();
`;

export function ThemeToggle() {
  const [dark, setDark] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setReady(true);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(KEY, next ? "dark" : "light");
    } catch {
      // Mode privat / site data diblokir: tema tetap berlaku untuk sesi ini.
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      aria-label={dark ? "Mode terang" : "Mode gelap"}
      title={dark ? "Mode terang" : "Mode gelap"}
      className="w-7 px-0"
    >
      {ready && dark ? (
        <SunIcon size={14} weight="bold" />
      ) : (
        <MoonIcon size={14} weight="bold" />
      )}
    </Button>
  );
}
