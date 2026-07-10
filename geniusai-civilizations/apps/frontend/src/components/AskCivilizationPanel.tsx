import { useMemo, useState } from "react";
import { answerAsCivilization, derivePersonality } from "../simulationInsights";
import { CIV_COLOR, CIV_LABEL, type CivId, type GameEvent, type World } from "../types";
import type { AskState } from "../useGameSocket";

interface Props {
  world: World | null;
  selected: CivId;
  events: GameEvent[];
  answer?: AskState;
  onAsk: (civ: CivId, question: string) => void;
}

const SUGGESTIONS = [
  "Por que você escolheu essa estratégia?",
  "Quem é sua maior ameaça agora?",
  "Qual legado você quer deixar?",
  "Você prefere guerra, ciência ou comércio?",
];

/**
 * "Pergunte à civilização": consulta o AGENTE REAL via backend (comando
 * `ask`, somente leitura — não avança o turno nem altera memória). Se o
 * runner falhar, o erro fica visível e um resumo heurístico local é
 * oferecido claramente rotulado como estimativa.
 */
export function AskCivilizationPanel({ world, selected, events, answer, onAsk }: Props) {
  const [question, setQuestion] = useState(SUGGESTIONS[0]);
  const profile = useMemo(() => derivePersonality(world, selected, events), [world, selected, events]);
  const localFallback = useMemo(
    () => (answer?.status === "error" ? answerAsCivilization(world, selected, events, answer.question) : ""),
    [world, selected, events, answer],
  );

  const submit = (q: string) => {
    const text = q.trim();
    if (text) onAsk(selected, text);
  };

  return (
    <section className="living-card ask-card" style={{ "--civ": CIV_COLOR[selected] } as React.CSSProperties}>
      <div className="living-card-head">
        <div>
          <p className="eyebrow">Pergunte à civilização</p>
          <h2>{CIV_LABEL[selected]} responde</h2>
        </div>
        <span className="soft-chip">{profile.mood}</span>
      </div>
      <div className="question-row">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit(question)}
          aria-label="Pergunta para a civilização"
        />
        <button
          className="btn btn-primary"
          disabled={answer?.status === "loading"}
          onClick={() => submit(question)}
        >
          {answer?.status === "loading" ? "Consultando…" : "Perguntar"}
        </button>
      </div>
      <div className="suggestions">
        {SUGGESTIONS.map((item) => (
          <button key={item} onClick={() => { setQuestion(item); submit(item); }}>{item}</button>
        ))}
      </div>

      {!answer && (
        <p className="muted ask-hint">
          A resposta vem do agente real da civilização (somente leitura — não avança o turno).
        </p>
      )}
      {answer?.status === "loading" && (
        <p className="live-text">O agente de {CIV_LABEL[selected]} está formulando a resposta…</p>
      )}
      {answer?.status === "done" && (
        <>
          <blockquote>{answer.text}</blockquote>
          <p className="answer-source">— {CIV_LABEL[selected]}, via runner <b>{answer.runner}</b></p>
        </>
      )}
      {answer?.status === "error" && (
        <>
          <p className="bad ask-error">O agente não respondeu: {answer.error}</p>
          <blockquote>{localFallback}</blockquote>
          <p className="answer-source">— estimativa local (heurística, sem o agente)</p>
        </>
      )}
    </section>
  );
}
