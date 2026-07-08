import { useMemo, useState } from "react";
import { answerAsCivilization, derivePersonality } from "../simulationInsights";
import { CIV_COLOR, CIV_LABEL, type CivId, type GameEvent, type World } from "../types";

interface Props {
  world: World | null;
  selected: CivId;
  events: GameEvent[];
}

const SUGGESTIONS = [
  "Por que você escolheu essa estratégia?",
  "Quem é sua maior ameaça agora?",
  "Qual legado você quer deixar?",
  "Você prefere guerra, ciência ou comércio?",
];

export function AskCivilizationPanel({ world, selected, events }: Props) {
  const [question, setQuestion] = useState(SUGGESTIONS[0]);
  const [asked, setAsked] = useState(SUGGESTIONS[0]);
  const profile = useMemo(() => derivePersonality(world, selected, events), [world, selected, events]);
  const answer = useMemo(() => answerAsCivilization(world, selected, events, asked), [world, selected, events, asked]);

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
        <input value={question} onChange={(e) => setQuestion(e.target.value)} aria-label="Pergunta para a civilização" />
        <button className="btn btn-primary" onClick={() => setAsked(question.trim() || SUGGESTIONS[0])}>Perguntar</button>
      </div>
      <div className="suggestions">
        {SUGGESTIONS.map((item) => (
          <button key={item} onClick={() => { setQuestion(item); setAsked(item); }}>{item}</button>
        ))}
      </div>
      <blockquote>{answer}</blockquote>
    </section>
  );
}
