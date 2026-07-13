import { test } from "node:test";
import assert from "node:assert/strict";
import { emit, newRequestId } from "./logger";

function captureConsole(): { logs: string[]; errors: string[]; restore: () => void } {
  const logs: string[] = [];
  const errors: string[] = [];
  const origLog = console.log;
  const origError = console.error;
  console.log = (line: string) => logs.push(line);
  console.error = (line: string) => errors.push(line);
  return {
    logs,
    errors,
    restore: () => {
      console.log = origLog;
      console.error = origError;
    },
  };
}

test("emit (pretty, padrão): linha legível com mensagem e campos", () => {
  delete process.env.LOG_FORMAT;
  const cap = captureConsole();
  try {
    emit("info", "tick concluído", { gameId: "game-1", tick: 3, operation: "tick_end", durationMs: 12 });
  } finally {
    cap.restore();
  }
  assert.equal(cap.logs.length, 1);
  assert.match(cap.logs[0], /^\[info\] tick concluído \(/);
  assert.match(cap.logs[0], /gameId=game-1/);
  assert.match(cap.logs[0], /tick=3/);
  assert.match(cap.logs[0], /operation=tick_end/);
  assert.match(cap.logs[0], /durationMs=12/);
});

test("emit (pretty): sem campos extras não sobra parêntese vazio", () => {
  delete process.env.LOG_FORMAT;
  const cap = captureConsole();
  try {
    emit("info", "mensagem simples");
  } finally {
    cap.restore();
  }
  assert.equal(cap.logs[0], "[info] mensagem simples");
});

test("emit: level='error' vai para console.error, nunca console.log", () => {
  delete process.env.LOG_FORMAT;
  const cap = captureConsole();
  try {
    emit("error", "falhou", { errorCode: "BOOM" });
  } finally {
    cap.restore();
  }
  assert.equal(cap.logs.length, 0);
  assert.equal(cap.errors.length, 1);
  assert.match(cap.errors[0], /errorCode=BOOM/);
});

test("emit (json): uma linha JSON com todos os campos estruturados (RNF-003)", () => {
  process.env.LOG_FORMAT = "json";
  const cap = captureConsole();
  try {
    emit("info", "comando processado", {
      requestId: "abc12345",
      gameId: "game-1",
      tick: 5,
      civilizationId: "rome",
      operation: "step",
      durationMs: 42,
    });
  } finally {
    cap.restore();
    delete process.env.LOG_FORMAT;
  }
  const parsed = JSON.parse(cap.logs[0]);
  assert.equal(parsed.level, "info");
  assert.equal(parsed.msg, "comando processado");
  assert.equal(parsed.requestId, "abc12345");
  assert.equal(parsed.gameId, "game-1");
  assert.equal(parsed.tick, 5);
  assert.equal(parsed.civilizationId, "rome");
  assert.equal(parsed.operation, "step");
  assert.equal(parsed.durationMs, 42);
  assert.ok(parsed.time, "deve carregar timestamp");
});

test("newRequestId: gera ids curtos e diferentes a cada chamada", () => {
  const a = newRequestId();
  const b = newRequestId();
  assert.equal(typeof a, "string");
  assert.equal(a.length, 8);
  assert.notEqual(a, b);
});
