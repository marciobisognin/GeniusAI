export interface EmptyStateGuideProps {
  onOpenProviders: () => void;
  onOpenLibrary: () => void;
  /** Já existe pelo menos um provedor cadastrado? Marca o passo 1 como feito. */
  hasProvider: boolean;
  /** Já existe pelo menos um agente/squad importado? Marca o passo 2 como feito. */
  hasLibrary: boolean;
}

interface StepProps {
  numero: number;
  done: boolean;
  titulo: string;
  descricao: string;
  action?: { label: string; onClick: () => void };
}

function Step({ numero, done, titulo, descricao, action }: StepProps) {
  return (
    <li style={{ display: "flex", gap: "var(--espaco-3)", alignItems: "flex-start" }}>
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: 28,
          height: 28,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          color: "#fff",
          background: done ? "var(--cor-sucesso)" : "var(--cor-agente)",
        }}
      >
        {done ? "✓" : numero}
      </span>
      <div style={{ flex: 1 }}>
        <strong style={{ display: "block", color: "var(--cor-texto)" }}>{titulo}</strong>
        <span style={{ color: "var(--cor-texto-suave)" }}>{descricao}</span>
        {action && !done && (
          <div style={{ marginTop: "var(--espaco-1)" }}>
            <button
              type="button"
              onClick={action.onClick}
              style={{
                padding: "var(--espaco-1) var(--espaco-3)",
                borderRadius: "var(--raio-pequeno)",
                border: "1px solid var(--cor-agente)",
                background: "var(--cor-agente)",
                color: "#fff",
                cursor: "pointer",
                fontSize: "var(--texto-corpo)",
              }}
            >
              {action.label}
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * Primeiro contato (didática dentro do produto): quando o canvas está
 * vazio, o centro da tela mostra os três primeiros passos com botões que
 * abrem os painéis certos — em vez de uma parede branca com seis botões
 * no topo. Some sozinho assim que o primeiro nó nasce.
 */
export function EmptyStateGuide({ onOpenProviders, onOpenLibrary, hasProvider, hasLibrary }: EmptyStateGuideProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 5,
        fontFamily: "var(--fonte-ui)",
        fontSize: "var(--texto-corpo)",
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          width: 460,
          maxWidth: "90vw",
          background: "var(--cor-fundo)",
          border: "1px solid var(--cor-borda)",
          borderRadius: "var(--raio)",
          boxShadow: "var(--sombra-flutuante)",
          padding: "var(--espaco-4)",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "var(--texto-titulo)", color: "var(--cor-texto)" }}>
          Seu canvas está vazio — comece por aqui
        </h2>
        <p style={{ margin: "var(--espaco-2) 0 var(--espaco-4)", color: "var(--cor-texto-suave)" }}>
          Três passos e um agente real estará trabalhando para você.
        </p>
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--espaco-4)" }}>
          <Step
            numero={1}
            done={hasProvider}
            titulo="Conecte um provedor de IA"
            descricao="Ollama local, ChatGPT, Claude... é quem vai pensar pelos agentes."
            action={{ label: "Abrir Provedores", onClick: onOpenProviders }}
          />
          <Step
            numero={2}
            done={hasLibrary}
            titulo="Importe a Biblioteca"
            descricao="Agentes e squads prontos do so-ia, Foresight e Civilizations."
            action={{ label: "Abrir Biblioteca", onClick: onOpenLibrary }}
          />
          <Step
            numero={3}
            done={false}
            titulo="Arraste um agente para o canvas"
            descricao="Escolha o provedor no nó, descreva a tarefa e clique em ▶ — o resultado aparece ao vivo."
          />
        </ol>
      </div>
    </div>
  );
}
