import { useState } from "react";
import { useDialogKeyboard } from "./useDialogKeyboard.js";

export interface HelpPanelProps {
  open: boolean;
  onClose: () => void;
}

interface GuideStep {
  titulo: string;
  descricao: string;
  imagem: string;
}

const STEPS: GuideStep[] = [
  {
    titulo: "1. Canvas vazio",
    descricao: 'Ao abrir, o badge no canto superior esquerdo mostra "Super Construtor: conectado" — é o sinal de que a interface achou o servidor.',
    imagem: "/guia/01-canvas-vazio.png",
  },
  {
    titulo: "2. Cadastrar um provedor LLM",
    descricao: "Clique em Provedores e preencha nome, tipo (ollama já vem selecionado) e baseUrl (para Ollama local, normalmente http://localhost:11434).",
    imagem: "/guia/02-provedor-formulario.png",
  },
  {
    titulo: "3. Testar a conexão",
    descricao: 'Depois de "Adicionar provedor", clique em "Testar conexão" — isso chama o provedor de verdade (no servidor, nunca no navegador) e marca "saudável" se responder.',
    imagem: "/guia/03-provedor-testado.png",
  },
  {
    titulo: "4. Importar a Biblioteca",
    descricao: 'Clique em Biblioteca → "Importar da Biblioteca" — isso lê os catálogos reais do so-ia, do geniusai-foresight e do geniusai-civilizations e traz os agentes/squads prontos.',
    imagem: "/guia/04-biblioteca-importada.png",
  },
  {
    titulo: "5. Arrastar um agente para o canvas",
    descricao: "Arraste um agente da lista para o canvas — ele vira um nó real.",
    imagem: "/guia/05-agente-no-canvas.png",
  },
  {
    titulo: "6. Escolher o provedor e descrever a tarefa",
    descricao: "No próprio nó, escolha o provedor no seletor e digite a tarefa em linguagem natural.",
    imagem: "/guia/06-tarefa-digitada.png",
  },
  {
    titulo: "7. Clicar em ▶ e ver rodar ao vivo",
    descricao: "Um nó de Execução novo aparece, ligado ao agente, mostrando cada passo em tempo real — inclusive se pausar pedindo aprovação humana (autonomia A0–A2).",
    imagem: "/guia/07-execucao-ao-vivo.png",
  },
  {
    titulo: "8. Aprovar e ver concluir",
    descricao: 'A partir daqui, essa aprovação já virou aprendizado: rode uma tarefa parecida de novo e o log vai mostrar "Memória: N trecho(s)...".',
    imagem: "/guia/08-aprovado-concluido.png",
  },
];

/**
 * Ajuda embutida no canvas: as mesmas 8 telas do Guia de Início Rápido,
 * sem sair do produto — quem instalou via npx nunca precisa achar o
 * README de novo pra lembrar o próximo passo.
 */
export function HelpPanel({ open, onClose }: HelpPanelProps) {
  const [passo, setPasso] = useState(0);
  const dialogRef = useDialogKeyboard(open, onClose);

  if (!open) return null;

  const step = STEPS[passo];
  const isFirst = passo === 0;
  const isLast = passo === STEPS.length - 1;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        aria-label="Ajuda — Passo a passo do Genius Allspark"
        style={{
          width: 760,
          maxWidth: "92vw",
          maxHeight: "88vh",
          overflowY: "auto",
          background: "var(--cor-fundo)",
          borderRadius: "var(--raio)",
          boxShadow: "var(--sombra-flutuante)",
          padding: "var(--espaco-4)",
          fontFamily: "var(--fonte-ui)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--espaco-3)" }}>
          <strong style={{ fontSize: "var(--texto-titulo)" }}>Como usar o Genius Allspark Canvas</strong>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 18 }}
          >
            ×
          </button>
        </div>

        <p style={{ margin: "0 0 var(--espaco-2)", color: "var(--cor-texto-suave)" }}>
          Passo {passo + 1} de {STEPS.length}
        </p>
        <h3 style={{ margin: "0 0 var(--espaco-2)", color: "var(--cor-texto)" }}>{step.titulo}</h3>
        <p style={{ margin: "0 0 var(--espaco-3)", color: "var(--cor-texto-suave)" }}>{step.descricao}</p>

        <img
          src={step.imagem}
          alt={step.titulo}
          style={{ width: "100%", borderRadius: "var(--raio-pequeno)", border: "1px solid var(--cor-borda)", marginBottom: "var(--espaco-4)" }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setPasso((p) => Math.max(0, p - 1))}
            disabled={isFirst}
            style={{ padding: "var(--espaco-1) var(--espaco-3)", cursor: isFirst ? "default" : "pointer", opacity: isFirst ? 0.4 : 1 }}
          >
            ← Anterior
          </button>
          <a
            href="https://github.com/marciobisognin/GeniusAI/blob/main/docs/GUIA-DE-INICIO-RAPIDO.md"
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: "var(--texto-pequeno)", color: "var(--cor-texto-suave)" }}
          >
            Ver guia completo no GitHub
          </a>
          <button
            type="button"
            onClick={() => (isLast ? onClose() : setPasso((p) => Math.min(STEPS.length - 1, p + 1)))}
            style={{
              padding: "var(--espaco-1) var(--espaco-3)",
              cursor: "pointer",
              border: "1px solid var(--cor-agente)",
              background: "var(--cor-agente)",
              color: "#fff",
              borderRadius: "var(--raio-pequeno)",
            }}
          >
            {isLast ? "Concluir" : "Próximo →"}
          </button>
        </div>
      </div>
    </div>
  );
}
