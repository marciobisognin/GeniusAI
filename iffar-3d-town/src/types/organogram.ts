// Tipos do organograma visual (Reitoria + campi) — extraídos de
// OfficeCanvas.tsx para uso compartilhado entre os módulos de
// src/components/organogram/.
//
// Nomenclatura: os apelidos CampusLayout/DepartmentRoom/AgentMember/RoleType
// abaixo existem para quem procura por esses nomes (convenção comum em
// organogramas espaciais 2D), mas apontam para os mesmos tipos já usados em
// produção — não há dois modelos de dados paralelos. Tudo continua vindo
// do organograma real carregado via GET /api/org-chart (nunca de dados fixos
// no frontend, ver businesses/iffar/org-chart.yaml e CLAUDE.md).

export interface OfficeAgent {
  id: string;
  name: string;
  title: string;
  color: string;
  cargo?: string;
  /** Código real do cargo na Portaria 876/2026 (ex.: "CD-0002", "FG-0001",
   * "FCC"). Guardado para fins de dados/futuras features, mas não é
   * exibido como badge na tela — decisão explícita: o que se mostra é a
   * repartição e a pessoa, nunca o código de função cru. */
  funcao?: string;
  groupId: string;
  groupLabel: string;
  isHead: boolean;
}

export interface CompetenciaLike {
  artigo: number;
  resumo: string | null;
}

export type Agent = OfficeAgent & { competencia?: CompetenciaLike | null };

/** Prefixo do campo `funcao` real (Anexo I da Portaria 876/2026). Não é
 * usado para renderizar um badge — só para tipar o dado com precisão. */
export type RoleType = "CD" | "FG" | "FCC";

export interface Zone {
  kind: "office" | "pod" | "lounge" | "meeting" | "break" | "zen" | "entrance";
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  agentIds: string[];
  doorX: number; // ponto de entrada/saída no corredor, em tiles
  floorA: string;
  floorB: string;
}

export interface Seat {
  agentId: string;
  deskX: number; // centro da mesa, em tiles
  deskY: number;
  zoneIndex: number;
}

// Bloco numerado — o agrupamento visual de uma Pró-Reitoria/Diretoria real
// (uma ou mais salas lado a lado), com moldura colorida e número, como nos
// organogramas de referência. Só repartições de fato (não a chefia, nem os
// espaços de convivência, nem "Colegiados e Comissões") ganham número.
export interface Block {
  index: number;
  label: string;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Plan {
  zones: Zone[];
  seats: Seat[];
  blocks: Block[];
  totalW: number;
  totalH: number;
  corridorY: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface WalkState {
  path: Point[];
  segLens: number[];
  totalLen: number;
  startTs: number;
  duration: number;
  color: string;
}

export interface DeptGroup {
  groupId: string;
  groupLabel: string;
  agentIds: string[];
}

// --- Apelidos pedidos pela convenção externa — mesmos tipos acima ---
export type CampusLayout = Plan;
export type DepartmentRoom = Zone;
export type AgentMember = Agent;
