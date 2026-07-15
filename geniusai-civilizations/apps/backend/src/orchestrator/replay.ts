import { DEFAULT_CIVILIZATIONS } from "@geniusai/shared";
import { tick } from "../engine/engine";
import { createWorld } from "../engine/world";
import type { CivDecision, World } from "../engine/types";
import type { TraceRecord } from "./trace";

/**
 * Reconstrói a sequência completa de `World` de uma partida a partir do
 * trace gravado (Fase 21, §21 — RF-24), usando o MESMO `tick()` do motor de
 * produção — nunca uma segunda implementação paralela. `ticks[0]` é o mundo
 * inicial (antes de qualquer decisão); `ticks[i]` é o resultado do i-ésimo
 * registro do trace. Determinístico: mesma seed + mesmo trace → mesma
 * sequência, sempre (a mesma garantia que já vale para `tick()` isolado).
 *
 * `definitions` é sempre o catálogo padrão porque o protocolo atual
 * (`new_game`) não aceita civilizações customizadas do cliente — toda
 * partida existente foi criada a partir dele.
 */
export function replayFromTrace(seed: number, fogOfWar: boolean, records: TraceRecord[]): World[] {
  let world = createWorld(seed, DEFAULT_CIVILIZATIONS, fogOfWar);
  const ticks: World[] = [world];
  for (const record of records) {
    const decisions: CivDecision[] = record.decisions.map((d) => ({ civ: d.civ, actions: d.actions }));
    world = tick(world, decisions);
    ticks.push(world);
  }
  return ticks;
}
