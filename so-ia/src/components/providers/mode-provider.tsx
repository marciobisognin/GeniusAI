"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type TenantMode = "empresa" | "governo";

interface ModeContextValue {
  mode: TenantMode;
  setMode: (mode: TenantMode) => void;
  toggleMode: () => void;
}

const ModeContext = createContext<ModeContextValue | null>(null);

const STORAGE_KEY = "so-ia:tenant-mode";

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<TenantMode>("empresa");

  // Read the persisted tenant mode after mount only — localStorage isn't
  // available during SSR, so doing this synchronously would mismatch the
  // server-rendered markup.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as TenantMode | null;
    if (stored === "empresa" || stored === "governo") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModeState(stored);
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-mode", mode);
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const setMode = useCallback((next: TenantMode) => setModeState(next), []);
  const toggleMode = useCallback(
    () => setModeState((prev) => (prev === "empresa" ? "governo" : "empresa")),
    [],
  );

  return (
    <ModeContext.Provider value={{ mode, setMode, toggleMode }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useTenantMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useTenantMode must be used within ModeProvider");
  return ctx;
}
