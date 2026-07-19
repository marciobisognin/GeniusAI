import type { ProviderConfig } from "@genius/canon";
import { apiClient } from "./client.js";

/** Hub de Provedores — registro e teste de conexão real (a chamada de rede acontece no servidor, nunca no navegador). */
export const providersApi = {
  list: () => apiClient.list<ProviderConfig>("providers"),
  create: (provider: ProviderConfig) => apiClient.create<ProviderConfig>("providers", provider),
  update: (id: string, patch: Partial<ProviderConfig>) =>
    apiClient.update<ProviderConfig>("providers", id, patch),
  remove: (id: string) => apiClient.remove("providers", id),
  healthCheck: (id: string) => apiClient.create<ProviderConfig>(`providers/${id}/health-check`, undefined),
};
