"use client";

import { useEffect, useState } from "react";
import { animate } from "framer-motion";

function parseValue(raw: string) {
  const match = raw.match(/^([^\d]*)([\d.,]+)(.*)$/);
  if (!match) return { prefix: "", number: null, suffix: raw, decimals: 0 };
  const [, prefix, numberPart, suffix] = match;
  const normalized = numberPart.replace(/\./g, "").replace(",", ".");
  const number = Number.parseFloat(normalized);
  const decimals = numberPart.includes(",") ? numberPart.split(",")[1]?.length ?? 0 : 0;
  if (Number.isNaN(number)) return { prefix: "", number: null, suffix: raw, decimals: 0 };
  return { prefix, number, suffix, decimals };
}

export function AnimatedNumber({ value, className }: { value: string; className?: string }) {
  const { prefix, number, suffix, decimals } = parseValue(value);
  const [display, setDisplay] = useState(number === null ? "" : "0");

  useEffect(() => {
    if (number === null) return;
    const controls = animate(0, number, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        const formatted =
          decimals > 0
            ? latest.toLocaleString("pt-BR", {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
              })
            : Math.round(latest).toLocaleString("pt-BR");
        setDisplay(formatted);
      },
    });
    return () => controls.stop();
  }, [number, decimals]);

  if (number === null) {
    return <span className={className}>{suffix}</span>;
  }

  return (
    <span className={className}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
