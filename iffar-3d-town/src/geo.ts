// Nome de exibição de uma unidade sem o prefixo "Campus " (ex.: "Campus
// Alegrete" -> "Alegrete", "Reitoria" -> "Reitoria") — usado no título do
// escritório e no cartão de transição entre unidades.
export function cityKeyFromName(nome: string): string {
  return nome.replace(/^Campus\s+/i, "").trim();
}
