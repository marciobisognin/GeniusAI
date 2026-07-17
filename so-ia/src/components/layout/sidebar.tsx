"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useTenantMode } from "@/components/providers/mode-provider";
import { useOrganization } from "@/components/providers/organization-provider";
import { areasByMode, areasFromNodes, primaryNav, tenantLabel } from "@/lib/nav-config";
import { getApprovalsForOrganization } from "@/lib/data/approvals";
import { LogoMark } from "@/components/layout/logo-mark";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const { mode } = useTenantMode();
  const organization = useOrganization();
  const ready = organization.status === "ready";
  const areas = ready ? areasFromNodes(organization.nodes) : areasByMode[mode];
  const orgLabel = organization.orgName || tenantLabel[mode].org;
  // Badge da Caixa de Aprovações = pendências reais das áreas do organograma.
  const pendencias = ready
    ? getApprovalsForOrganization(organization.orgType, organization.nodes).length
    : 0;

  return (
    <aside className="hidden lg:flex lg:w-72 lg:flex-col lg:shrink-0 border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-sidebar-border">
        <LogoMark />
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight">SO-IA</p>
          <p className="text-[11px] text-muted-foreground">
            Sistema Operacional de IA
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-6">
        <div className="space-y-0.5">
          {primaryNav.map((item) => {
            const active = pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "text-sidebar-foreground"
                    : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
                )}
              >
                {active && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-lg bg-sidebar-accent"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <Icon
                  className={cn(
                    "relative z-10 size-4",
                    active && "text-[var(--brand-1)]",
                  )}
                />
                <span className="relative z-10">{item.label}</span>
                {item.href === "/app/aprovacoes" && pendencias > 0 && (
                  <Badge
                    variant="secondary"
                    className="relative z-10 ml-auto h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px] bg-gradient-brand text-white border-0"
                  >
                    {pendencias}
                  </Badge>
                )}
              </Link>
            );
          })}
        </div>

        <div>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-1.5">
            {ready ? "Áreas do organograma" : mode === "empresa" ? "Áreas de Negócio" : "Modo Governo · Áreas"}
          </p>
          <div className="space-y-0.5">
            {areas.map((area) => (
              <div
                key={area.label}
                className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/40 transition-colors cursor-default"
              >
                <area.icon className="size-3.5 shrink-0" />
                <span className="truncate">{area.label}</span>
              </div>
            ))}
          </div>
        </div>
      </nav>

      <div className="px-4 py-4 border-t border-sidebar-border">
        <div className="glass-panel rounded-xl px-3 py-2.5">
          <p className="text-[11px] text-muted-foreground">Tenant ativo</p>
          <p className="text-sm font-medium truncate">{orgLabel}</p>
        </div>
      </div>
    </aside>
  );
}
