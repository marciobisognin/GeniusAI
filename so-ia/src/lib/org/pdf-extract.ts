"use client";

interface PdfTextItem {
  str: string;
  transform: number[];
}

/**
 * Extrai o texto de um PDF no navegador, agrupando itens por posição Y (linha)
 * e ordenando por X (esquerda→direita) dentro de cada linha. Organogramas em
 * caixas/gráficos tendem a extrair como texto fragmentado — o parser de texto
 * sinaliza isso para revisão manual.
 */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
  const lines: string[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const rows = new Map<number, { x: number; str: string }[]>();

    for (const item of content.items as PdfTextItem[]) {
      if (!item.str.trim()) continue;
      const y = Math.round(item.transform[5] / 2) * 2;
      const row = rows.get(y) ?? [];
      row.push({ x: item.transform[4], str: item.str });
      rows.set(y, row);
    }

    if (rows.size === 0) continue;
    // A posição X mais à esquerda da página vira a margem-base; o restante
    // do recuo visual (indentação de organogramas/listas) é convertido em
    // espaços à esquerda, para que o parser de texto detecte a hierarquia.
    const baseX = Math.min(...Array.from(rows.values()).map((row) => row[0]?.x ?? Infinity));
    const sortedYs = Array.from(rows.keys()).sort((a, b) => b - a);
    for (const y of sortedYs) {
      const row = rows.get(y)!.sort((a, b) => a.x - b.x);
      const text = row
        .map((r) => r.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (!text) continue;
      const indentSpaces = Math.max(0, Math.round(((row[0].x - baseX) / 24) * 2));
      lines.push(" ".repeat(indentSpaces) + text);
    }
  }

  return lines.join("\n");
}
