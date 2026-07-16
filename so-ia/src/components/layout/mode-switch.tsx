"use client";

import { motion } from "framer-motion";
import { Building2, Landmark } from "lucide-react";
import { useTenantMode, type TenantMode } from "@/components/providers/mode-provider";
import { cn } from "@/lib/utils";

const options: { mode: TenantMode; label: string; icon: typeof Building2 }[] = [
  { mode: "empresa", label: "Empresa", icon: Building2 },
  { mode: "governo", label: "Governo", icon: Landmark },
];

export function ModeSwitch({ className }: { className?: string }) {
  const { mode, setMode } = useTenantMode();

  return (
    <div
      className={cn(
        "relative flex items-center rounded-full border border-border bg-secondary/70 p-1",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.mode === mode;
        const Icon = opt.icon;
        return (
          <button
            key={opt.mode}
            type="button"
            onClick={() => setMode(opt.mode)}
            className={cn(
              "relative z-10 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors cursor-pointer",
              active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId="mode-switch-pill"
                className="absolute inset-0 -z-10 rounded-full bg-gradient-brand"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <Icon className="size-3.5" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
