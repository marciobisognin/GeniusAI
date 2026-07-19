/**
 * Embedding local por "hashing trick" (feature hashing) — vetor de
 * frequência de termos, hasheado para uma dimensão fixa e normalizado
 * (L2). Não é uma rede neural, mas é matemática real de recuperação por
 * similaridade (mesma família de PLN clássico usada em produção, ex.:
 * Vowpal Wabbit): funciona sem chamar nenhum provedor externo, então a
 * memória indexada funciona mesmo sem um provedor LLM configurado. Se um
 * dia trocar por embeddings de verdade (API), só esta função muda — o
 * resto do pacote não sabe a diferença.
 */

const DIMENSIONS = 128;

function tokenize(text: string): string[] {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .match(/[a-z0-9]+/g) ?? []
  );
}

function hashToken(token: string): number {
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
  }
  return hash % DIMENSIONS;
}

export function embedText(text: string): number[] {
  const vector = new Array(DIMENSIONS).fill(0);
  for (const token of tokenize(text)) {
    vector[hashToken(token)] += 1;
  }
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
}
