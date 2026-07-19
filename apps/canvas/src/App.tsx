import { useEffect, useState } from "react";

/**
 * Placeholder da Etapa 0 — só prova que o app compila, builda e fala com o
 * Super Construtor (`@genius/constructor`). O motor de canvas de verdade
 * (React Flow, nós, minimapa, zoom) é construído na Etapa 1.
 */
export function App() {
  const [status, setStatus] = useState<"verificando" | "conectado" | "offline">("verificando");

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_CONSTRUCTOR_URL ?? "http://127.0.0.1:4001";
    fetch(`${apiUrl}/health`)
      .then((res) => (res.ok ? setStatus("conectado") : setStatus("offline")))
      .catch(() => setStatus("offline"));
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>Genius Allspark Canvas</h1>
      <p>Fundação do monorepo (Etapa 0) — o motor de canvas chega na Etapa 1.</p>
      <p>
        Super Construtor: <strong>{status}</strong>
      </p>
    </main>
  );
}
