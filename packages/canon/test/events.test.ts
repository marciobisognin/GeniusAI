import { describe, expect, it } from "vitest";
import { createEvent, EventPayloadSchemas, EventType, parseEvent } from "../src/events.js";

describe("catálogo de eventos", () => {
  it("todo EventType declarado tem um schema de payload registrado", () => {
    for (const type of EventType.options) {
      expect(EventPayloadSchemas[type], `faltando schema de payload para "${type}"`).toBeDefined();
    }
  });

  it("createEvent produz um envelope válido e correlacionável", () => {
    const event = createEvent(
      "run.started",
      { runId: "r1", taskId: "t1" },
      "corr-1",
    );
    expect(event.correlationId).toBe("corr-1");
    expect(event.type).toBe("run.started");
  });

  it("parseEvent rejeita payload que não bate com o schema do tipo", () => {
    expect(() =>
      parseEvent({
        id: "e1",
        type: "run.started",
        ts: new Date().toISOString(),
        correlationId: "corr-1",
        payload: { somethingElse: true },
      }),
    ).toThrow();
  });

  it("parseEvent rejeita tipo de evento desconhecido", () => {
    expect(() =>
      parseEvent({
        id: "e2",
        type: "evento.inexistente",
        ts: new Date().toISOString(),
        correlationId: "corr-1",
        payload: {},
      }),
    ).toThrow();
  });
});
