"use client";

import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  { href: "/onboarding/tipo", label: "Tipo de organização" },
  { href: "/onboarding/organograma", label: "Organograma" },
  { href: "/onboarding/montagem", label: "Montagem do sistema" },
];

export function StepIndicator() {
  const pathname = usePathname();
  const activeIndex = steps.findIndex((s) => pathname?.startsWith(s.href));

  return (
    <ol className="flex items-center gap-2 sm:gap-4">
      {steps.map((step, i) => {
        const state = i < activeIndex ? "done" : i === activeIndex ? "active" : "todo";
        return (
          <li key={step.href} className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "relative flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium",
                  state === "done" && "border-transparent bg-gradient-brand text-white",
                  state === "active" && "border-[var(--brand-1)] text-[var(--brand-1)]",
                  state === "todo" && "border-border text-muted-foreground",
                )}
              >
                {state === "done" ? <Check className="size-3" /> : i + 1}
                {state === "active" && (
                  <motion.span
                    className="absolute inset-0 rounded-full border border-[var(--brand-1)]"
                    animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                  />
                )}
              </span>
              <span
                className={cn(
                  "hidden text-xs font-medium sm:block",
                  state === "todo" ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && <div className="h-px w-6 bg-border sm:w-10" />}
          </li>
        );
      })}
    </ol>
  );
}
