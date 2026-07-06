import { useEffect, useRef, useState } from "react";

const BACKEND_WS = import.meta.env.VITE_BACKEND_WS ?? "ws://localhost:8787";

interface Status {
  connected: boolean;
  runner?: string;
  healthy?: boolean;
}

export function App() {
  const [status, setStatus] = useState<Status>({ connected: false });
  const [log, setLog] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(BACKEND_WS);
    wsRef.current = ws;

    ws.onopen = () => setStatus((s) => ({ ...s, connected: true }));
    ws.onclose = () => setStatus((s) => ({ ...s, connected: false }));
    ws.onmessage = (ev) => {
      let msg: { type?: string; runner?: string; healthy?: boolean };
      try {
        msg = JSON.parse(ev.data as string);
      } catch {
        return;
      }
      setLog((l) => [JSON.stringify(msg), ...l].slice(0, 20));
      if (msg.type === "hello" || msg.type === "health") {
        setStatus((s) => ({
          ...s,
          runner: msg.runner ?? s.runner,
          healthy: msg.healthy ?? s.healthy,
        }));
      }
    };

    return () => ws.close();
  }, []);

  return (
    <main className="app">
      <header>
        <h1>GeniusAI Civilizations</h1>
        <p className="tag">Watchable AI · Fase 0 (scaffold)</p>
      </header>

      <section className="card">
        <h2>Status</h2>
        <div className="row">
          <span>Backend</span>
          <b className={status.connected ? "ok" : "bad"}>
            {status.connected ? "conectado" : "desconectado"}
          </b>
        </div>
        <div className="row">
          <span>Runner</span>
          <b>{status.runner ?? "—"}</b>
        </div>
        <div className="row">
          <span>Saúde do runner</span>
          <b className={status.healthy ? "ok" : status.healthy === false ? "bad" : ""}>
            {status.healthy === undefined ? "—" : status.healthy ? "OK" : "indisponível"}
          </b>
        </div>
      </section>

      <section className="card">
        <h2>Eventos (WebSocket)</h2>
        <ul className="log">
          {log.length === 0 ? (
            <li className="muted">aguardando mensagens…</li>
          ) : (
            log.map((l, i) => <li key={i}>{l}</li>)
          )}
        </ul>
      </section>

      <footer className="muted">
        Aqui, nas próximas fases: o mapa do mundo, os painéis de raciocínio das
        civilizações e a linha do tempo de eventos.
      </footer>
    </main>
  );
}
