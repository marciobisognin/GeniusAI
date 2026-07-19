import type { Agent, Company, MindClone, Pack, Squad } from "@genius/canon";
import { apiClient } from "./client.js";

export interface RoleSpec {
  titulo: string;
  area?: string;
  responsabilidades?: string[];
}

export interface MatchResponse<T> {
  candidate: T | null;
  score: number;
  draft: T;
}

export interface AvailablePackFile {
  filename: string;
  valid: boolean;
  nome?: string;
  versao?: string;
  error?: string;
}

export interface ImportPackResult {
  agentesNovos: string[];
  agentesExistentes: string[];
  squadsNovos: string[];
  squadsExistentes: string[];
  company: Company;
}

/** Cliente da Etapa 4 — Super Construtor: Companies, Squads, Mind-Clones, reaproveitar/criar e Packs. */
export const constructorApi = {
  companies: {
    list: () => apiClient.list<Company>("companies"),
    create: (company: Company) => apiClient.create<Company>("companies", company),
    update: (id: string, patch: Partial<Company>) => apiClient.update<Company>("companies", id, patch),
  },
  squads: {
    create: (squad: Squad) => apiClient.create<Squad>("squads", squad),
    update: (id: string, patch: Partial<Squad>) => apiClient.update<Squad>("squads", id, patch),
    get: (id: string) => apiClient.get<Squad>("squads", id),
  },
  agents: {
    create: (agent: Agent) => apiClient.create<Agent>("agents", agent),
    get: (id: string) => apiClient.get<Agent>("agents", id),
  },
  mindClones: {
    list: () => apiClient.list<MindClone>("mind-clones"),
    create: (clone: MindClone) => apiClient.create<MindClone>("mind-clones", clone),
  },
  matchAgent: (spec: RoleSpec) => apiClient.create<MatchResponse<Agent>>("agents/match", spec),
  matchSquad: (spec: RoleSpec) => apiClient.create<MatchResponse<Squad>>("squads/match", spec),
  packs: {
    exportCompany: (companyId: string) => apiClient.create<Pack>(`companies/${companyId}/export-pack`, undefined),
    importIntoCompany: (companyId: string, pack: Pack) =>
      apiClient.create<ImportPackResult>(`companies/${companyId}/import-pack`, pack),
    listAvailable: () => apiClient.list<AvailablePackFile>("packs/available"),
    importFile: (filename: string, companyId: string) =>
      apiClient.create<ImportPackResult>("packs/import", { filename, companyId }),
  },
};
