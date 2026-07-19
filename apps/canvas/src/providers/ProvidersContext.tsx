import { createContext, useContext } from "react";
import type { ProviderConfig } from "@genius/canon";

export const ProvidersContext = createContext<ProviderConfig[]>([]);

export function useProviders(): ProviderConfig[] {
  return useContext(ProvidersContext);
}
