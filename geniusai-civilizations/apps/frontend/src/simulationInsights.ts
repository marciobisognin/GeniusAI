import {
  CIV_IDS,
  CIV_LABEL,
  describeEvent,
  type CivId,
  type Civilization,
  type GameEvent,
  type Stance,
  type World,
} from "./types";

export interface EraStage {
  key: string;
  label: string;
  tick: number;
  description: string;
}

export const ERA_STAGES: EraStage[] = [
  { key: "tribal", label: "Tribal", tick: 0, description: "fundação, sobrevivência e primeiras rotas" },
  { key: "agricultural", label: "Agrícola", tick: 4, description: "produção, cidades e domínio do território" },
  { key: "urban", label: "Urbana", tick: 8, description: "instituições, obras e especialização" },
  { key: "imperial", label: "Imperial", tick: 14, description: "diplomacia, guerra e expansão regional" },
  { key: "scientific", label: "Científica", tick: 22, description: "tecnologia, legado e memória histórica" },
];

export interface EraProgress {
  current: EraStage;
  next?: EraStage;
  progress: number;
}

export interface PersonalityProfile {
  ambition: number;
  fear: number;
  trust: number;
  curiosity: number;
  aggression: number;
  stability: number;
  mood: string;
  doctrine: string;
}

export interface CrisisSignal {
  id: string;
  civ?: CivId;
  title: string;
  severity: "baixa" | "média" | "alta";
  detail: string;
}

export interface TechNode {
  id: string;
  label: string;
  branch: "agricultura" | "militar" | "cultura" | "comércio" | "ciência";
  unlocked: boolean;
  active: boolean;
}

export interface ChronicleChapter {
  title: string;
  subtitle: string;
  events: GameEvent[];
}

export interface MuseumRoom {
  title: string;
  curatorNote: string;
  accent: CivId | "world";
  artifacts: string[];
}

const BASE_PERSONALITY: Record<CivId, Omit<PersonalityProfile, "mood" | "doctrine">> = {
  rome: { ambition: 78, fear: 28, trust: 42, curiosity: 48, aggression: 62, stability: 58 },
  egypt: { ambition: 54, fear: 36, trust: 50, curiosity: 52, aggression: 35, stability: 72 },
  greece: { ambition: 49, fear: 29, trust: 57, curiosity: 82, aggression: 31, stability: 60 },
  mali: { ambition: 58, fear: 25, trust: 67, curiosity: 55, aggression: 28, stability: 64 },
};

const TECH_CATALOG: Array<Omit<TechNode, "unlocked" | "active">> = [
  { id: "agriculture", label: "Agricultura", branch: "agricultura" },
  { id: "irrigation", label: "Irrigação", branch: "agricultura" },
  { id: "granary", label: "Armazéns", branch: "agricultura" },
  { id: "bronze", label: "Bronze", branch: "militar" },
  { id: "walls", label: "Muralhas", branch: "militar" },
  { id: "cavalry", label: "Cavalaria", branch: "militar" },
  { id: "writing", label: "Escrita", branch: "cultura" },
  { id: "philosophy", label: "Filosofia", branch: "cultura" },
  { id: "law", label: "Direito", branch: "cultura" },
  { id: "currency", label: "Moeda", branch: "comércio" },
  { id: "caravans", label: "Caravanas", branch: "comércio" },
  { id: "navigation", label: "Navegação", branch: "comércio" },
  { id: "mathematics", label: "Matemática", branch: "ciência" },
  { id: "astronomy", label: "Astronomia", branch: "ciência" },
  { id: "engineering", label: "Engenharia", branch: "ciência" },
];

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeTech(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");
}

function eventHasCiv(e: GameEvent, civ: CivId): boolean {
  return Object.values(e).some((value) => value === civ);
}

function relationEntries(world: World | null, civ: CivId): Stance[] {
  if (!world) return [];
  return Object.entries(world.diplomacy)
    .filter(([key]) => key.split("|").includes(civ))
    .map(([, stance]) => stance);
}

export function getEraProgress(tick: number): EraProgress {
  const sorted = [...ERA_STAGES].sort((a, b) => a.tick - b.tick);
  let current = sorted[0];
  let next: EraStage | undefined;
  for (let i = 0; i < sorted.length; i += 1) {
    if (tick >= sorted[i].tick) {
      current = sorted[i];
      next = sorted[i + 1];
    }
  }
  if (!next) return { current, progress: 100 };
  const span = Math.max(1, next.tick - current.tick);
  return { current, next, progress: clamp(((tick - current.tick) / span) * 100) };
}

export function derivePersonality(world: World | null, civId: CivId, events: GameEvent[]): PersonalityProfile {
  const base = BASE_PERSONALITY[civId];
  const civ = world?.civilizations[civId];
  const recent = events.filter((e) => eventHasCiv(e, civId)).slice(0, 30);
  const relations = relationEntries(world, civId);
  const warCount = relations.filter((s) => s === "war").length;
  const allianceCount = relations.filter((s) => s === "alliance" || s === "trade").length;
  const battleCount = recent.filter((e) => e.type === "battle" || e.type === "city_captured").length;
  const researchCount = recent.filter((e) => e.type === "research_started" || e.type === "tech_researched").length;
  const rejectionCount = recent.filter((e) => e.type === "action_rejected").length;
  const food = civ?.resources.food ?? 0;
  const gold = civ?.resources.gold ?? 0;
  const science = civ?.resources.science ?? 0;
  const cities = civ?.cities.length ?? 0;
  const armies = civ?.armies.length ?? 0;

  const profile: PersonalityProfile = {
    ambition: clamp(base.ambition + cities * 4 + gold / 4 + (civ?.tech.length ?? 0) * 3),
    fear: clamp(base.fear + warCount * 15 + rejectionCount * 8 - allianceCount * 5 - food / 8),
    trust: clamp(base.trust + allianceCount * 12 - warCount * 13 - battleCount * 8),
    curiosity: clamp(base.curiosity + researchCount * 10 + science / 4 + (civ?.researching ? 8 : 0)),
    aggression: clamp(base.aggression + armies * 5 + warCount * 18 + battleCount * 14 - allianceCount * 4),
    stability: clamp(base.stability + food / 5 + cities * 6 - rejectionCount * 11 - warCount * 8),
    mood: "",
    doctrine: "",
  };

  if (!civ?.alive) profile.mood = "colapso";
  else if (profile.fear > 70) profile.mood = "ameaçada";
  else if (profile.stability > 72 && profile.trust > 58) profile.mood = "próspera";
  else if (profile.aggression > 70) profile.mood = "expansionista";
  else if (profile.curiosity > 72) profile.mood = "renascentista";
  else profile.mood = "em consolidação";

  if (profile.aggression >= profile.curiosity && profile.aggression >= profile.trust) profile.doctrine = "pressão militar";
  else if (profile.curiosity >= profile.trust) profile.doctrine = "avanço científico-cultural";
  else if (profile.trust >= 60) profile.doctrine = "diplomacia e comércio";
  else profile.doctrine = "sobrevivência estratégica";

  return profile;
}

export function deriveTechTree(civ?: Civilization): TechNode[] {
  const unlocked = new Set((civ?.tech ?? []).map(normalizeTech));
  const active = normalizeTech(civ?.researching ?? "");
  return TECH_CATALOG.map((node) => {
    const key = normalizeTech(node.id + node.label);
    const isUnlocked = [...unlocked].some((t) => key.includes(t) || t.includes(normalizeTech(node.id)) || t.includes(normalizeTech(node.label)));
    return {
      ...node,
      unlocked: isUnlocked,
      active: Boolean(active) && (active.includes(normalizeTech(node.id)) || active.includes(normalizeTech(node.label))),
    };
  });
}

export function deriveCrises(world: World | null, events: GameEvent[]): CrisisSignal[] {
  if (!world) return [];
  const crises: CrisisSignal[] = [];
  for (const id of CIV_IDS) {
    const civ = world.civilizations[id];
    const relations = relationEntries(world, id);
    const recent = events.filter((e) => eventHasCiv(e, id)).slice(0, 20);
    if (!civ.alive) {
      crises.push({ id: `${id}-fallen`, civ: id, title: `${CIV_LABEL[id]} eliminada`, severity: "alta", detail: "A civilização saiu do tabuleiro e virou legado histórico." });
      continue;
    }
    if (civ.resources.food < 16) crises.push({ id: `${id}-food`, civ: id, title: "Pressão alimentar", severity: "alta", detail: `${CIV_LABEL[id]} tem pouco alimento para sustentar crescimento urbano.` });
    if (civ.resources.gold < 10) crises.push({ id: `${id}-gold`, civ: id, title: "Tesouro baixo", severity: "média", detail: "Pouca reserva de ouro limita obras, comércio e reação militar." });
    if (civ.resources.science < 8 && world.tick > 6) crises.push({ id: `${id}-science`, civ: id, title: "Atraso científico", severity: "média", detail: "O avanço tecnológico está lento para a era atual." });
    if (relations.includes("war")) crises.push({ id: `${id}-war`, civ: id, title: "Tensão de guerra", severity: "alta", detail: "Relações hostis elevam risco de captura, colapso e revanche." });
    if (recent.filter((e) => e.type === "action_rejected").length >= 2) crises.push({ id: `${id}-friction`, civ: id, title: "Atrito decisório", severity: "baixa", detail: "A IA tentou ações que o motor rejeitou; estratégia precisa se ajustar." });
  }
  if (world.tick > 0 && world.tick % 9 === 0) {
    crises.push({ id: `world-drought-${world.tick}`, title: "Ciclo climático instável", severity: "média", detail: "Ventos secos atravessam o mapa; civilizações agrícolas ficam mais vulneráveis." });
  }
  return crises.slice(0, 8);
}

export function buildChronicle(events: GameEvent[]): ChronicleChapter[] {
  const relevant = events.filter((e) => e.type !== "tick_started").slice(0, 36);
  const chapters: ChronicleChapter[] = [
    { title: "Capítulo I — Fundação", subtitle: "os primeiros assentamentos e estratégias", events: [] },
    { title: "Capítulo II — Expansão", subtitle: "territórios, obras e cidades", events: [] },
    { title: "Capítulo III — Diplomacia", subtitle: "alianças, guerras e comércio", events: [] },
    { title: "Capítulo IV — Legado", subtitle: "tecnologias, narrativas e viradas históricas", events: [] },
  ];
  for (const e of relevant) {
    if (["structure_built", "tile_claimed", "city_grew"].includes(e.type)) chapters[1].events.push(e);
    else if (["diplomacy_changed", "trade_executed", "battle", "city_captured", "civ_eliminated"].includes(e.type)) chapters[2].events.push(e);
    else if (["research_started", "tech_researched", "narration", "strategy_updated"].includes(e.type)) chapters[3].events.push(e);
    else chapters[0].events.push(e);
  }
  return chapters;
}

export function buildMuseumRooms(world: World | null, events: GameEvent[]): MuseumRoom[] {
  const era = getEraProgress(world?.tick ?? 0).current;
  const opening = events.slice(0, 8).map(describeEvent);
  const topCiv = CIV_IDS
    .map((id) => ({ id, score: (world?.civilizations[id].resources.gold ?? 0) + (world?.civilizations[id].resources.science ?? 0) + (world?.civilizations[id].cities.length ?? 0) * 12 }))
    .sort((a, b) => b.score - a.score)[0]?.id ?? "world";

  return [
    {
      title: "Sala 1 — Fundação das Civilizações",
      curatorNote: "Mapa inicial, recursos e primeiros polos urbanos.",
      accent: "world",
      artifacts: [
        `Era atual: ${era.label}`,
        `Tick observado: ${world?.tick ?? 0}`,
        `Semente histórica: ${world?.seed ?? "—"}`,
      ],
    },
    {
      title: "Sala 2 — Decisões que mudaram o mapa",
      curatorNote: "Eventos recentes organizados como peças de exposição.",
      accent: topCiv,
      artifacts: opening.length ? opening.slice(0, 4) : ["A exposição aguarda os primeiros eventos da simulação."],
    },
    {
      title: "Sala 3 — Legado vivo",
      curatorNote: "Quem acumula recursos, conhecimento e influência deixa marcas mais profundas.",
      accent: topCiv,
      artifacts: CIV_IDS.map((id) => `${CIV_LABEL[id]}: ${world?.civilizations[id].tech.length ?? 0} tecnologias · ${world?.civilizations[id].cities.length ?? 0} cidades`),
    },
  ];
}

export function answerAsCivilization(world: World | null, civId: CivId, events: GameEvent[], question: string): string {
  const civ = world?.civilizations[civId];
  const profile = derivePersonality(world, civId, events);
  const recent = events.filter((e) => eventHasCiv(e, civId)).slice(0, 2).map(describeEvent);
  const memory = civ?.memory?.trim();
  const context = recent.length ? `Nos eventos recentes, ${recent.join("; ")}.` : "Ainda estamos escrevendo nossos primeiros registros.";
  const resources = civ ? `Temos ${civ.resources.food} de alimento, ${civ.resources.gold} de ouro e ${civ.resources.science} de ciência.` : "O escriba ainda não recebeu o estado do mundo.";
  const strategic = memory ? `Nossa memória estratégica diz: “${memory}”.` : `Nossa doutrina atual é ${profile.doctrine}.`;
  return `Sou ${CIV_LABEL[civId]}. ${resources} Estamos em estado ${profile.mood}, com ambição ${profile.ambition} e confiança ${profile.trust}. ${strategic} ${context} Sobre “${question}”: responderemos priorizando ${profile.doctrine}, porque é isso que preserva nosso legado nesta era.`;
}
