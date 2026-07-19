import type { Agent, Squad } from "@genius/canon";
import { apiClient } from "./client.js";

export interface LibraryImportResult {
  agentesNovos: string[];
  agentesExistentes: string[];
  squadsNovos: string[];
  squadsExistentes: string[];
  totalAgentes: number;
  totalSquads: number;
}

/** Biblioteca de Agentes & Squads — catálogo real (importado de so-ia/foresight/civilizations) + reaproveitáveis no canvas. */
export const libraryApi = {
  listAgents: () => apiClient.list<Agent>("agents"),
  listSquads: () => apiClient.list<Squad>("squads"),
  importFromRepo: () => apiClient.create<LibraryImportResult>("library/import", undefined),
};
