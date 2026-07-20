import { useCallback, useRef, useState } from "react";

export type ToastKind = "sucesso" | "erro" | "aprendizado" | "info";

export interface Toast {
  id: string;
  kind: ToastKind;
  text: string;
}

const KIND_COLOR: Record<ToastKind, string> = {
  sucesso: "var(--cor-sucesso)",
  erro: "var(--cor-erro)",
  aprendizado: "var(--cor-aprendizado)",
  info: "var(--cor-texto-suave)",
};

const KIND_ICON: Record<ToastKind, string> = {
  sucesso: "✓",
  erro: "✕",
  aprendizado: "✦",
  info: "ℹ",
};

/** Fila de toasts do canvas — feedback dentro da linguagem do produto, no lugar de window.alert/JSON bruto. */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const notify = useCallback(
    (kind: ToastKind, text: string) => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { id, kind, text }]);
      // Aprendizado fica mais tempo na tela — é o momento que a Etapa 6 existe para mostrar.
      const ttl = kind === "aprendizado" ? 9000 : 6000;
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), ttl),
      );
    },
    [dismiss],
  );

  return { toasts, notify, dismiss };
}

export interface ToastHostProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ToastHost({ toasts, onDismiss }: ToastHostProps) {
  if (toasts.length === 0) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: "var(--espaco-4)",
        right: "var(--espaco-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--espaco-2)",
        zIndex: 1100,
        maxWidth: 360,
        fontFamily: "var(--fonte-ui)",
        fontSize: "var(--texto-corpo)",
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "var(--espaco-2)",
            background: "var(--cor-fundo)",
            border: "1px solid var(--cor-borda)",
            borderLeft: `4px solid ${KIND_COLOR[toast.kind]}`,
            borderRadius: "var(--raio)",
            boxShadow: "var(--sombra-flutuante)",
            padding: "var(--espaco-3)",
          }}
        >
          <span aria-hidden style={{ color: KIND_COLOR[toast.kind], fontWeight: 700 }}>
            {KIND_ICON[toast.kind]}
          </span>
          <span style={{ flex: 1, color: "var(--cor-texto)" }}>{toast.text}</span>
          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={() => onDismiss(toast.id)}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--cor-texto-apagado)",
              fontSize: 14,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
