import { useEffect, useState } from "react";

const KEY = "umbral-theme";

export function getStoredTheme() {
  if (typeof window === "undefined") return "system";
  return localStorage.getItem(KEY) || "system";
}

export function resolveTheme(pref) {
  if (pref === "dark") return "dark";
  if (pref === "light") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(pref) {
  const resolved = resolveTheme(pref);
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function setStoredTheme(pref) {
  localStorage.setItem(KEY, pref);
  applyTheme(pref);
}

export function useTheme() {
  const [pref, setPref] = useState(getStoredTheme());

  useEffect(() => {
    applyTheme(pref);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (getStoredTheme() === "system") applyTheme("system");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [pref]);

  return [pref, (next) => {
    setPref(next);
    setStoredTheme(next);
  }];
}