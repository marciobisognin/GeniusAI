#!/usr/bin/env bun
/**
 * Stand-in para o Nirvana OS, usado como padrão de `NIRVANA_ENGINE_PATH`
 * quando nenhuma instalação real está configurada (Opção A do README —
 * explorar a interface sem depender do Nirvana OS). Não faz orquestração de
 * verdade: só escreve um `result.md` de exemplo no ticket corrente, para que
 * o fluxo de Inbox/artefato do IFFar 3D Town funcione de ponta a ponta.
 *
 * Uso: bun stub-engine.ts <negocio> <problema>
 */

const [, , business, ...rest] = process.argv;
const problem = rest.join(" ");
const ticketId = process.env.IFFAR_TICKET_ID;
const ticketsDir = process.env.IFFAR_TICKETS_DIR;

console.log(`[stub-engine] negócio: ${business ?? "(não informado)"}`);
console.log(`[stub-engine] briefing: ${problem || "(vazio)"}`);

if (ticketId && ticketsDir) {
  const path = `${ticketsDir}/${ticketId}/result.md`;
  await Bun.write(
    path,
    [
      "# Parecer — Simulação (stub-engine)",
      "",
      "> Este artefato foi gerado pelo `tools/stub-engine.ts`, o stand-in usado quando",
      "> `NIRVANA_ENGINE_PATH` não aponta para uma instalação real do Nirvana OS.",
      "> Não é um parecer institucional — é apenas para demonstrar o fluxo de ponta a",
      "> ponta (bridge → engine → ticket → Inbox) sem depender de outro sistema.",
      "",
      `**Ticket:** ${ticketId}`,
      "",
      "**Briefing recebido:**",
      "",
      problem || "(nenhum briefing informado)",
    ].join("\n"),
  );
  console.log(`[stub-engine] artefato de exemplo escrito em ${path}`);
} else {
  console.warn("[stub-engine] IFFAR_TICKET_ID/IFFAR_TICKETS_DIR ausentes; nada foi escrito.");
}
