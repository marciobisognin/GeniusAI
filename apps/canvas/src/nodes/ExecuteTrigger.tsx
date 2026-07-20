import { useState } from "react";

export interface ExecuteTriggerProps {
  onExecute?: (taskDescription: string) => void;
}

/** Campo de tarefa + botão "▶" — compartilhado por AgentNode e SquadNode (Etapa 5). */
export function ExecuteTrigger({ onExecute }: ExecuteTriggerProps) {
  const [task, setTask] = useState("");
  if (!onExecute) return null;

  function submit() {
    const trimmed = task.trim();
    if (!trimmed) return;
    onExecute!(trimmed);
    setTask("");
  }

  return (
    <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
      <input
        value={task}
        placeholder="Descreva a tarefa..."
        onChange={(e) => setTask(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        style={{ flex: 1, border: "1px solid var(--cor-borda)", borderRadius: 4, padding: 4, fontSize: 12 }}
      />
      <button
        type="button"
        aria-label="Executar"
        title="Executar"
        onClick={submit}
        disabled={!task.trim()}
        style={{
          border: "1px solid var(--cor-borda)",
          borderRadius: 4,
          padding: "4px 8px",
          background: task.trim() ? "var(--cor-sucesso)" : "var(--cor-borda)",
          color: "#fff",
          cursor: task.trim() ? "pointer" : "default",
        }}
      >
        ▶
      </button>
    </div>
  );
}
