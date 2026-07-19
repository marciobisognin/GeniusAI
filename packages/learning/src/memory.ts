import { LocalIndex } from "vectra";
import { embedText } from "./embeddings.js";

export interface MemorySearchResult {
  id: string;
  score: number;
  text: string;
  sourceType: string;
  sourceId: string;
  createdAt: string;
}

export interface IndexChunkInput {
  id: string;
  text: string;
  sourceType: string;
  sourceId: string;
  createdAt: string;
}

/**
 * Índice vetorial local (vectra) — um `LocalIndex` por pasta em disco.
 * `ensureReady()` cria o índice na primeira operação (vectra é assíncrono;
 * evita forçar o resto do pacote a virar assíncrono só por causa disso).
 */
export class LearningMemory {
  private readonly index: LocalIndex;
  private readyPromise: Promise<void> | null = null;

  constructor(folderPath: string) {
    this.index = new LocalIndex(folderPath);
  }

  private async ensureReady(): Promise<void> {
    if (!this.readyPromise) {
      this.readyPromise = (async () => {
        if (!(await this.index.isIndexCreated())) {
          await this.index.createIndex();
        }
      })();
    }
    return this.readyPromise;
  }

  async indexChunk(input: IndexChunkInput): Promise<void> {
    await this.ensureReady();
    await this.index.upsertItem({
      id: input.id,
      vector: embedText(input.text),
      metadata: {
        text: input.text,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        createdAt: input.createdAt,
      },
    });
  }

  async search(query: string, k = 5): Promise<MemorySearchResult[]> {
    await this.ensureReady();
    const results = await this.index.queryItems(embedText(query), query, k);
    return results.map((r) => ({
      id: r.item.id,
      score: r.score,
      text: String(r.item.metadata.text),
      sourceType: String(r.item.metadata.sourceType),
      sourceId: String(r.item.metadata.sourceId),
      createdAt: String(r.item.metadata.createdAt),
    }));
  }
}
