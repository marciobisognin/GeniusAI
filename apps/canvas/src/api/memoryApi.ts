const BASE_URL = import.meta.env.VITE_CONSTRUCTOR_URL ?? "http://127.0.0.1:4001";

export interface MemoryProvenance {
  taskDescricao: string;
  agenteNome?: string;
  aprovadoEm: string;
}

export interface MemorySearchResult {
  id: string;
  score: number;
  text: string;
  sourceType: string;
  sourceId: string;
  createdAt: string;
  /** Procedência já resolvida pelo servidor — não é para o cliente adivinhar o que um UUID significa. */
  procedencia: MemoryProvenance | null;
}

/** Cliente da Memória Indexada (Etapa 6) — busca por significado, não por palavra-chave. */
export const memoryApi = {
  async search(query: string, k = 5): Promise<MemorySearchResult[]> {
    const res = await fetch(`${BASE_URL}/memory/search?q=${encodeURIComponent(query)}&k=${k}`);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`GET /memory/search -> ${res.status}: ${body}`);
    }
    return res.json();
  },
};
