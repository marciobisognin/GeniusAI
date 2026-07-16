import type { TenantMode } from "./data/types";
import {
  LayoutGrid,
  Bot,
  Workflow,
  ClipboardCheck,
  Database,
  ShieldCheck,
  Landmark,
  Wallet,
  Users,
  GraduationCap,
  Radio,
  Server,
  Boxes,
  TrendingUp,
  Megaphone,
  Handshake,
  HeadphonesIcon,
  Briefcase,
  Network,
  Layers,
  Building2,
  Gauge,
  Puzzle,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { OrgNode } from "./data/org-chart";

export interface PrimaryNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

export const primaryNav: PrimaryNavItem[] = [
  { href: "/app/dashboard", label: "Centro de Comando", icon: LayoutGrid },
  { href: "/app/organograma", label: "Organograma", icon: Network },
  { href: "/app/agentes", label: "Agentes & Skills", icon: Bot },
  { href: "/app/squads", label: "Squads", icon: UsersRound },
  { href: "/app/workflows", label: "Workflows", icon: Workflow },
  { href: "/app/aprovacoes", label: "Caixa de Aprovações", icon: ClipboardCheck, badge: "4" },
  { href: "/app/conhecimento", label: "Núcleo de Conhecimento", icon: Database },
  { href: "/app/auditoria", label: "Auditoria", icon: ShieldCheck },
];

export interface AreaNavItem {
  label: string;
  icon: LucideIcon;
}

export const areasByMode: Record<TenantMode, AreaNavItem[]> = {
  empresa: [
    { label: "Vendas", icon: TrendingUp },
    { label: "Negócios", icon: Handshake },
    { label: "Marketing", icon: Megaphone },
    { label: "Operações", icon: Boxes },
    { label: "Inteligência", icon: Radio },
    { label: "Clientes", icon: HeadphonesIcon },
    { label: "Back Office", icon: Briefcase },
  ],
  governo: [
    { label: "Licitações e Contratos", icon: Landmark },
    { label: "Orçamento e Finanças", icon: Wallet },
    { label: "Gestão de Pessoas", icon: Users },
    { label: "Ensino/Pesquisa/Extensão", icon: GraduationCap },
    { label: "Gabinete/Governança", icon: ShieldCheck },
    { label: "Comunicação", icon: Radio },
    { label: "TI", icon: Server },
    { label: "Patrimônio/Almoxarifado", icon: Boxes },
  ],
};

export const tenantLabel: Record<TenantMode, { name: string; org: string }> = {
  empresa: { name: "Modo Empresa", org: "Acme Soluções Ltda." },
  governo: { name: "Modo Governo", org: "IFFar — Campus Frederico Westphalen" },
};

const dynamicAreaIcons = [Landmark, Wallet, Users, GraduationCap, ShieldCheck, Radio, Server, Boxes, TrendingUp, Megaphone, Handshake, HeadphonesIcon, Briefcase, Layers, Building2, Gauge, Puzzle];

function hashString(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash;
}

export function areasFromNodes(nodes: OrgNode[]): AreaNavItem[] {
  const labels = Array.from(new Set(nodes.map((n) => n.area.trim()).filter(Boolean)));
  return labels.map((label) => ({
    label,
    icon: dynamicAreaIcons[hashString(label) % dynamicAreaIcons.length],
  }));
}
