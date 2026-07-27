import { useState, useEffect, useRef, useMemo } from "react";
import { parse as parseYaml } from "yaml";
import { OfficeCanvas } from "./OfficeCanvas";
import { MapCanvas } from "./MapCanvas";
import { RS_CITY_COORDS, cityKeyFromName } from "./geo";

// Types

// Espelha businesses/iffar/org-chart.yaml — tudo que a cena mostra deriva
// deste organograma; nenhuma unidade é inventada no frontend.
interface OrgUnit {
  id: string;
  slug: string;
  nome: string;
  parent: string | null;
  cargo?: string;
  funcao?: string;
}

interface CompetenciaEntry {
  artigo: number;
  unidade_titulo: string;
  slug: string;
  resumo: string | null;
  total_incisos: number;
}

interface AgentNode {
  id: string;
  name: string;
  title: string;
  campus: string;
  color: string;
  pos: [number, number];
  cargo?: string;
  funcao?: string;
}

interface MapLocation {
  id: string;
  nome: string;
  pos: [number, number];
  primaryAgentId: string;
}

interface InboxItem {
  id: string;
  date: string;
  title: string;
  link: string;
  summary: string;
}

const CAMPUS_ROOT_RE = /^1\.\d+$/;

function normalizeName(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Posição estável derivada do id da unidade (nunca coordenadas hardcoded) —
// mesmo id sempre cai no mesmo ângulo dentro do escritório, então o layout
// não "pula" entre carregamentos.
function hashAngle(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return (hash % 1000) / 1000;
}

function colorForCargo(cargo?: string): string {
  if (!cargo) return "#64748b"; // comissões/núcleos sem cargo definido
  if (cargo.includes("REITOR")) return "#8b5cf6"; // Reitor(a) / Pró-Reitor(a)
  if (cargo === "DIRETOR(A) GERAL") return "#f59e0b"; // Diretor(a) Geral de campus
  if (cargo.startsWith("DIRETOR")) return "#06b6d4"; // Diretorias
  if (cargo.startsWith("COORDENADOR")) return "#10b981"; // Coordenações
  if (cargo === "PRESIDENTE") return "#ef4444"; // comissões/colegiados
  if (cargo === "CHEFE") return "#3b82f6";
  return "#84cc16";
}

// Toda unidade tem um local físico real: a Reitoria (Santa Maria) ou o
// campus a que pertence — sobe a cadeia de pais até achar um dos dois, para
// saber em qual prédio do mapa a câmera deve entrar.
function physicalLocationId(unitId: string, unitsById: Map<string, OrgUnit>): string {
  let current = unitsById.get(unitId);
  while (current) {
    if (current.id === "1.1" || CAMPUS_ROOT_RE.test(current.id)) return current.id;
    if (!current.parent) return "1.1";
    current = unitsById.get(current.parent);
  }
  return "1.1";
}

// ---------------------------------------------------------------------------
// ARTIFACT VIEWER MODAL COMPONENT (IN-APP DOCUMENT READER)
// ---------------------------------------------------------------------------

const ArtifactViewerModal = ({
  item,
  onClose,
}: {
  item: InboxItem | null;
  onClose: () => void;
}) => {
  const [content, setContent] = useState<string>(
    "Carregando conteúdo do arquivo...",
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!item) return;
    setLoading(true);

    fetch(item.link)
      .then((res) => res.text())
      .then((text) => {
        setContent(text);
        setLoading(false);
      })
      .catch((err) => {
        setContent(`Erro ao carregar o artefato: ${err.message}`);
        setLoading(false);
      });
  }, [item]);

  if (!item) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#181517] border border-[#382e34] rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
        {/* Modal Header */}
        <div className="p-4 border-b border-[#2d262a] flex items-center justify-between bg-[#120f11]">
          <div className="flex items-center gap-3">
            <span className="text-xl">📄</span>
            <div>
              <h2 className="text-sm font-bold text-amber-500 font-mono">
                {item.title}
              </h2>
              <p className="text-[11px] text-stone-400 font-mono">
                Gerado em: {item.date}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1 bg-[#282125] hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-mono transition-colors"
            >
              {copied ? "✓ COPIADO!" : "📋 COPIAR TEXTO"}
            </button>
            <a
              href={item.link}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1 bg-[#282125] hover:bg-stone-700 text-stone-300 border border-stone-700 rounded-lg text-xs font-mono transition-colors"
            >
              ↗ ABRIR EM NOVA ABA
            </a>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-[#282125] hover:bg-red-500/20 text-stone-400 hover:text-red-400 border border-stone-700 flex items-center justify-center text-sm transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body / Markdown Text Reader */}
        <div className="flex-1 overflow-y-auto p-6 font-mono text-xs text-stone-300 leading-relaxed bg-[#0d0b0c] whitespace-pre-wrap selection:bg-amber-500/30">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-3 text-amber-400 font-bold">
              <span className="animate-spin text-lg">⚙️</span>
              <span>Lendo artefato no servidor...</span>
            </div>
          ) : (
            content
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-[#2d262a] bg-[#120f11] flex items-center justify-between text-[11px] font-mono text-stone-500">
          <span>NIRVANA OS - INSTITUTO FEDERAL FARROUPILHA</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold rounded-lg transition-colors"
          >
            FECHAR LEITOR
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// MAIN CLAW3D APPLICATION
// ---------------------------------------------------------------------------

export default function App() {
  const bridgeUrl = import.meta.env.VITE_BRIDGE_URL ?? "http://localhost:4000";
  const [activeTab, setActiveTab] = useState<"PLAYBOOKS" | "INBOX" | "HISTORY">(
    "PLAYBOOKS",
  );
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeStatusMsg, setActiveStatusMsg] = useState("");
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [selectedArtifact, setSelectedArtifact] = useState<InboxItem | null>(
    null,
  );

  // Artifacts & History State
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [historyItems, setHistoryItems] = useState<
    { id: string; time: string; prompt: string; success: boolean }[]
  >([]);

  // Organograma real, carregado de GET /api/org-chart — nenhuma unidade é
  // hardcoded no frontend; se um setor não existe no organograma servido
  // pelo bridge, ele simplesmente não aparece na cena.
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [competencias, setCompetencias] = useState<CompetenciaEntry[]>([]);
  const [expandedCampusId, setExpandedCampusId] = useState<string | null>(null);
  const [campusFilterId, setCampusFilterId] = useState<string | null>(null);

  // "Corte" de cena: um flash rápido quando a câmera pula de um prédio para
  // outro (Reitoria <-> campus, ou campus -> campus), para reforçar a
  // sensação de mudança de cenário em vez de um sobrevoo contínuo.
  const [sceneFlash, setSceneFlash] = useState(false);
  const triggerSceneFlash = () => {
    setSceneFlash(true);
    setTimeout(() => setSceneFlash(false), 260);
  };

  // Só revela o escritório (interior) depois que o zoom de câmera no mapa
  // termina — dá a sensação de "a câmera entra no prédio" em vez de um corte
  // seco direto para a sala.
  const [officeVisible, setOfficeVisible] = useState(false);
  const prevLocationRef = useRef<string | null>(null);

  useEffect(() => {
    fetch(`${bridgeUrl}/api/org-chart`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        const doc = parseYaml(text) as { units: OrgUnit[] };
        setOrgUnits(doc.units ?? []);
      })
      .catch((err) => {
        console.error("Falha ao carregar /api/org-chart:", err);
        setOrgError(
          "Não foi possível carregar o organograma do bridge. Verifique se o Nirvana Bridge está rodando.",
        );
      });

    fetch(`${bridgeUrl}/api/competencias`)
      .then((res) => (res.ok ? res.text() : null))
      .then((text) => {
        if (!text) return;
        const doc = parseYaml(text) as { competencias: CompetenciaEntry[] };
        setCompetencias(doc.competencias ?? []);
      })
      .catch(() => {
        // enriquecimento opcional — sem ele a UI só perde o resumo de competência
      });
  }, [bridgeUrl]);

  const unitsById = useMemo(() => {
    const map = new Map<string, OrgUnit>();
    for (const u of orgUnits) map.set(u.id, u);
    return map;
  }, [orgUnits]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string, OrgUnit[]>();
    for (const u of orgUnits) {
      if (!u.parent) continue;
      const list = map.get(u.parent) ?? [];
      list.push(u);
      map.set(u.parent, list);
    }
    return map;
  }, [orgUnits]);

  const competenciaByName = useMemo(() => {
    const map = new Map<string, CompetenciaEntry>();
    for (const c of competencias) map.set(normalizeName(c.unidade_titulo), c);
    return map;
  }, [competencias]);

  const campusRoots = useMemo(
    () =>
      orgUnits
        .filter((u) => CAMPUS_ROOT_RE.test(u.id) && u.id !== "1.1")
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    [orgUnits],
  );

  // Agentes/prédios exibidos por padrão: Reitoria + Pró-Reitorias + o
  // Gabinete do(a) Diretor(a) Geral de cada campus (~20 prédios). Clicar em
  // um campus expande as diretorias vinculadas ao Gabinete daquele campus —
  // evita colocar as ~450 unidades na cena de uma vez.
  const agents: AgentNode[] = useMemo(() => {
    if (orgUnits.length === 0) return [];
    const reitoria = unitsById.get("1.1");
    if (!reitoria) return [];

    const list: OrgUnit[] = [reitoria];
    const proReitorias = (childrenByParent.get("1.1") ?? []).filter((u) =>
      (u.cargo ?? "").includes("REITOR"),
    );
    list.push(...proReitorias);

    const visibleCampi = campusFilterId
      ? campusRoots.filter((c) => c.id === campusFilterId)
      : campusRoots;

    for (const campus of visibleCampi) {
      const gabinete = (childrenByParent.get(campus.id) ?? []).find((u) =>
        normalizeName(u.nome).includes("gabinete"),
      );
      if (gabinete) list.push(gabinete);
      if (expandedCampusId === campus.id && gabinete) {
        list.push(...(childrenByParent.get(gabinete.id) ?? []));
      }
    }

    return list.map((unit) => {
      const isReitoria = unit.id === "1.1";
      const isCampusGabinete = campusRoots.some((c) => c.id === unit.parent);

      // Todo agente mora fisicamente num dos 14 prédios do mapa (Reitoria
      // ou o campus a que pertence) — a posição vem das coordenadas reais
      // desse prédio no RS, nunca de um layout arbitrário.
      const locationId = physicalLocationId(unit.id, unitsById);
      const locationUnit = unitsById.get(locationId);
      const cityKey = locationUnit ? cityKeyFromName(locationUnit.nome) : "Reitoria";
      const [baseX, baseZ] = RS_CITY_COORDS[cityKey] ?? [0, 0];

      let pos: [number, number];
      if (isReitoria || isCampusGabinete) {
        // marcador principal do prédio: exatamente na coordenada da cidade
        pos = [baseX, baseZ];
      } else {
        // demais agentes (Pró-Reitorias na Reitoria, diretorias/coordenações
        // expandidas num campus): espalhados perto do prédio, por um ângulo
        // estável derivado do próprio id (nunca hardcoded) — só usado como
        // fallback caso apareçam fora do escritório em algum momento.
        const angle = hashAngle(unit.id) * Math.PI * 2;
        const radius = 3.2 + (hashAngle(`${unit.id}r`) % 1) * 1.6;
        pos = [baseX + Math.cos(angle) * radius, baseZ + Math.sin(angle) * radius];
      }

      const ownerCampus = campusRoots.find((c) => c.id === unit.parent);
      // O rótulo do agente é sempre a função/unidade como está escrita no
      // organograma (nunca um nome de pessoa fictício). "Gabinete Do(a)
      // Diretor(a) Geral" se repete em todos os campi, então nesse caso
      // específico o nome do campus é anexado só para diferenciar o prédio —
      // nunca substitui a função.
      const displayName = ownerCampus
        ? `${unit.nome} — ${ownerCampus.nome.replace(/^Campus\s+/i, "")}`
        : unit.nome;

      const node: AgentNode = {
        id: unit.id,
        name: displayName,
        title: unit.nome,
        campus: ownerCampus?.nome ?? "Reitoria",
        color: colorForCargo(unit.cargo),
        pos,
        cargo: unit.cargo,
        funcao: unit.funcao,
      };
      return node;
    });
  }, [orgUnits, unitsById, childrenByParent, campusRoots, expandedCampusId, campusFilterId]);

  // Os 14 prédios do mapa (Reitoria + 13 campi) — sempre visíveis, com
  // posição real derivada de RS_CITY_COORDS, independentemente de qual
  // agente está ativo ou de qual campus está expandido/filtrado.
  const mapLocations: MapLocation[] = useMemo(() => {
    const reitoria = unitsById.get("1.1");
    if (!reitoria) return [];
    const list = [reitoria, ...campusRoots];
    return list.map((unit) => {
      const cityKey = cityKeyFromName(unit.nome);
      const [x, z] = RS_CITY_COORDS[cityKey] ?? [0, 0];
      // O prédio no mapa representa a unidade-sede fisicamente ali (a
      // Reitoria em si, ou o Gabinete do(a) Diretor(a) Geral do campus) —
      // é esse id que precisa existir em `agents` para a câmera focar.
      const primaryAgentId =
        unit.id === "1.1"
          ? "1.1"
          : ((childrenByParent.get(unit.id) ?? []).find((u) =>
              normalizeName(u.nome).includes("gabinete"),
            )?.id ?? unit.id);
      return {
        id: unit.id,
        nome: unit.nome,
        pos: [x, z] as [number, number],
        primaryAgentId,
      };
    });
  }, [unitsById, campusRoots, childrenByParent]);

  // Local físico (prédio) do agente ativo — usado pela câmera para saber
  // aonde "voar" e para decidir se houve mudança de cenário (novo prédio).
  const activeLocationId = useMemo(() => {
    if (!activeAgentId) return null;
    return physicalLocationId(activeAgentId, unitsById);
  }, [activeAgentId, unitsById]);

  const activeLocationUnit = useMemo(
    () => (activeLocationId ? mapLocations.find((l) => l.id === activeLocationId) ?? null : null),
    [activeLocationId, mapLocations],
  );

  // Agentes que "trabalham" fisicamente no prédio em foco — são eles que
  // aparecem como avatares dentro do escritório quando a câmera entra. Já
  // vem com a competência anexada, para o tooltip do OfficeCanvas.
  const agentsHere = useMemo(() => {
    if (!activeLocationId) return [];
    return agents
      .filter((a) => physicalLocationId(a.id, unitsById) === activeLocationId)
      .map((a) => ({ ...a, competencia: competenciaByName.get(normalizeName(a.title)) ?? null }));
  }, [activeLocationId, agents, unitsById, competenciaByName]);

  // Máquina de estados da câmera: zoom de drone para dentro do prédio em
  // foco (a partir da visão geral do mapa) revela o escritório só depois que
  // a animação termina; ao trocar de PRÉDIO (não só de agente dentro dele),
  // corta a cena com um flash em vez de deslizar sobre o mapa inteiro.
  // Rota da demanda sobre o mapa: registrada no momento do salto entre
  // prédios e mantida por alguns segundos, independente de qual prédio está
  // em foco — assim o tracejado aparece na transição e também se o usuário
  // voltar à visão geral (ou quando a câmera sai no fim da execução).
  const [mapRoute, setMapRoute] = useState<{
    from: [number, number];
    to: [number, number];
  } | null>(null);
  const routeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!activeLocationId) {
      setOfficeVisible(false);
      prevLocationRef.current = null;
      return;
    }

    const previous = prevLocationRef.current;
    prevLocationRef.current = activeLocationId;
    if (previous === activeLocationId) return; // mesmo prédio, outro agente: cena não muda

    setOfficeVisible(false);
    if (previous !== null) {
      triggerSceneFlash();
      const fromLoc = mapLocations.find((l) => l.id === previous);
      const toLoc = mapLocations.find((l) => l.id === activeLocationId);
      if (fromLoc && toLoc) {
        setMapRoute({ from: fromLoc.pos, to: toLoc.pos });
        if (routeTimerRef.current) clearTimeout(routeTimerRef.current);
        routeTimerRef.current = setTimeout(() => setMapRoute(null), 8000);
      }
    }
    const delay = previous === null ? 900 : 500;
    const timer = setTimeout(() => setOfficeVisible(true), delay);
    return () => clearTimeout(timer);
  }, [activeLocationId, mapLocations]);

  const handleSelectAgent = (agentId: string) => {
    const ownerCampus = campusRoots.find((c) =>
      (childrenByParent.get(c.id) ?? []).some((u) => u.id === agentId),
    );
    if (ownerCampus) {
      setExpandedCampusId((prev) => (prev === ownerCampus.id ? null : ownerCampus.id));
    }
    setActiveAgentId((prev) => (prev === agentId ? null : agentId));
  };

  // Execute Briefing Prompt with Strict Organogram Route & Camera Lerp Tracking
  const handleExecutePrompt = async (promptText: string) => {
    if (!promptText || loading) return;
    setLoading(true);
    setActiveStatusMsg(
      `Orquestrando pelo Organograma: "${promptText.substring(0, 25)}..."`,
    );

    try {
      const res = await fetch(`${bridgeUrl}/api/brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem: promptText }),
      });
      const data = await res.json();

      if (data.sequence) {
        // Resolução defensiva: se o passo referenciar uma unidade que não
        // está entre os agentes carregados (ex.: fora do nível de detalhe
        // exibido), registra um aviso e PULA o passo — nunca anima um
        // agente errado silenciosamente.
        const resolvableSteps = data.sequence
          .map((step: any) => ({
            step,
            agent: agents.find((a) => a.id === step.to || a.id === step.from),
          }))
          .filter(({ step, agent }: any) => {
            if (!agent) {
              console.warn(
                `[Organograma] Passo ignorado: unidade "${step.to}" não está entre os agentes exibidos.`,
              );
            }
            return Boolean(agent);
          });

        resolvableSteps.forEach(({ step, agent }: any, idx: number) => {
          setTimeout(() => {
            setActiveAgentId(agent.id);
            setActiveStatusMsg(`[${agent.name}] ${step.action}`);

            if (idx === resolvableSteps.length - 1) {
              setTimeout(async () => {
                setLoading(false);
                setActiveAgentId(null);
                setActiveStatusMsg("Orquestração Concluída com Sucesso!");

                setHistoryItems((prev) => [
                  {
                    id: data.ticketId ?? `ticket-${Date.now()}`,
                    time: new Date().toLocaleTimeString("pt-BR"),
                    prompt: promptText,
                    success: Boolean(data.success),
                  },
                  ...prev,
                ]);

                // Só entra no Inbox depois que /api/view-artifact confirmar
                // 200 — um link devolvido pelo bridge não garante que o
                // arquivo já esteja pronto para leitura.
                const link = data.artifacts?.[0];
                if (link) {
                  try {
                    const check = await fetch(link);
                    if (check.ok) {
                      const newInbox: InboxItem = {
                        id: data.ticketId ?? `ticket-${Date.now().toString().slice(-4)}`,
                        date: "AGORA",
                        title: `Resultado: ${promptText.substring(0, 30)}...`,
                        link,
                        summary:
                          "Artefato gerado e despachado pelo organograma do IFFar.",
                      };
                      setInboxItems((prev) => [newInbox, ...prev]);
                      setActiveTab("INBOX");
                      // Automatically open the new artifact in the reader modal!
                      setSelectedArtifact(newInbox);
                    }
                  } catch {
                    // artefato indisponível — a execução continua registrada no History
                  }
                }
              }, 3500);
            }
          }, step.delay);
        });

        if (resolvableSteps.length === 0) {
          setLoading(false);
          setActiveStatusMsg("Nenhum passo pôde ser reproduzido na cena atual.");
        }
      } else {
        setLoading(false);
      }
    } catch (e) {
      console.error(e);
      setLoading(false);
      setActiveStatusMsg("Erro ao conectar com Nirvana Bridge.");
    }
  };

  return (
    <div className="w-full h-screen bg-[#120f11] text-stone-200 flex flex-col font-sans overflow-hidden select-none">
      {/* TOP HEADER BAR */}
      <header className="h-14 shrink-0 bg-[#181517] border-b border-[#2d262a] px-4 flex items-center justify-between z-20 shadow-md">
        {/* Left Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-500 font-black text-sm">
            🏢
          </div>
          <span className="font-mono tracking-widest text-xs font-bold text-amber-500 uppercase whitespace-nowrap">
            IFFAR HEADQUARTERS
          </span>
          <span
            title="Simulação demonstrativa: não substitui o trâmite oficial via SIPAC."
            className="hidden md:inline text-[10px] font-mono text-stone-500 border border-stone-700/70 rounded px-1.5 py-0.5 whitespace-nowrap"
          >
            PROTÓTIPO DEMONSTRATIVO — NÃO SUBSTITUI O SIPAC
          </span>
        </div>

        {/* Center Agent Chips Bar */}
        <div className="flex-1 flex items-center justify-center gap-1.5 px-4 overflow-x-auto no-scrollbar">
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() =>
                setActiveAgentId(activeAgentId === agent.id ? null : agent.id)
              }
              title={agent.title}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold transition-all border shrink-0 ${
                activeAgentId === agent.id
                  ? "bg-amber-500 text-stone-950 border-amber-400 ring-2 ring-amber-500/40"
                  : "bg-[#221c20] text-stone-300 border-[#382e34] hover:bg-[#2c2429]"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${activeAgentId === agent.id ? "bg-red-600 animate-ping" : "bg-emerald-400"}`}
              />
              <span className="whitespace-nowrap max-w-[220px] truncate">
                {agent.name}
              </span>
            </button>
          ))}
        </div>

        {/* Campus filter + Gateway Status */}
        <div className="shrink-0 flex items-center gap-2">
          <select
            value={campusFilterId ?? ""}
            onChange={(e) => {
              const value = e.target.value || null;
              setCampusFilterId(value);
              setExpandedCampusId(value);
            }}
            className="text-[11px] font-mono bg-[#221c20] text-stone-300 border border-[#382e34] rounded-md px-2 py-1 focus:outline-none focus:border-amber-500"
          >
            <option value="">Todos os campi</option>
            {campusRoots.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome.replace(/^Campus\s+/i, "")}
              </option>
            ))}
          </select>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-md border border-emerald-800/50 flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {orgError ? "ORGANOGRAMA OFFLINE" : `${orgUnits.length} UNIDADES`}
          </span>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* LEFT VERTICAL ICON RAIL */}
        <aside className="w-12 shrink-0 bg-[#161214] border-r border-[#2d262a] flex flex-col items-center py-3 gap-5 z-10">
          <button className="w-8 h-8 rounded-lg hover:bg-[#282125] text-stone-400 flex items-center justify-center text-xs font-mono transition-colors">
            &gt;
          </button>
          <button className="w-8 h-8 rounded-lg hover:bg-[#282125] text-stone-400 flex items-center justify-center text-xs transition-colors">
            ⛶
          </button>
          <button className="w-8 h-8 rounded-lg hover:bg-[#282125] text-stone-400 flex items-center justify-center text-xs transition-colors">
            ⚙
          </button>
          <div className="w-6 h-[1px] bg-[#2d262a]" />
          <button className="w-8 h-8 rounded-lg hover:bg-[#282125] text-stone-400 flex items-center justify-center text-xs transition-colors">
            ⊞
          </button>
          <button className="w-8 h-8 rounded-lg hover:bg-[#282125] text-stone-400 flex items-center justify-center text-xs transition-colors">
            👥
          </button>
          <button className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center text-xs transition-colors shadow">
            🏢
          </button>
        </aside>

        {/* CENTER 2D MAP / OFFICE VIEWPORT */}
        <main
          className="flex-1 relative bg-[#120f11] overflow-hidden"
          style={{ contain: "paint" }}
        >
          {/* Flash de corte de cena — sobe a opacidade rapidamente e cai,
              simulando um corte de câmera ao mudar de prédio/campus */}
          <div
            className={`pointer-events-none absolute inset-0 z-30 bg-white transition-opacity duration-150 ${
              sceneFlash ? "opacity-80" : "opacity-0"
            }`}
          />

          {/* Mapa do RS em pixel art — o próprio MapCanvas cuida do zoom de
              câmera até o prédio em foco (origem travada no pixel exato). */}
          <MapCanvas
            locations={mapLocations}
            activeLocationId={activeLocationId}
            route={mapRoute}
            onSelect={(loc) => {
              if (loc.id !== "1.1") {
                setExpandedCampusId((prev) => (prev === loc.id ? null : loc.id));
              }
              setActiveAgentId((prev) =>
                prev === loc.primaryAgentId ? null : loc.primaryAgentId,
              );
            }}
          />

          {/* Escritório: só aparece depois do zoom de drone terminar */}
          {officeVisible && activeLocationUnit && (
            <OfficeCanvas
              buildingName={cityKeyFromName(activeLocationUnit.nome)}
              agents={agentsHere}
              activeAgentId={activeAgentId}
              statusMsg={activeStatusMsg}
              onSelectAgent={handleSelectAgent}
            />
          )}

          {/* Canvas Shortcut Controls */}
          <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2">
            <button
              onClick={() => setActiveAgentId(null)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono backdrop-blur flex items-center gap-1.5 shadow-xl transition-all ${
                activeAgentId === null
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/60 ring-2 ring-amber-500/30 font-bold"
                  : "bg-[#181517]/90 text-stone-400 border-stone-700/80 hover:text-stone-200"
              }`}
            >
              <span>🔍</span>
              <span>VISÃO GERAL</span>
            </button>
            {activeAgentId && (
              <span className="text-[11px] font-mono text-amber-400 bg-[#181517]/90 border border-amber-500/40 px-2.5 py-1 rounded-lg backdrop-blur truncate max-w-xs">
                🎯 FOCANDO: {agents.find((a) => a.id === activeAgentId)?.name}
              </span>
            )}
          </div>

          {/* Organogram Load Error Banner */}
          {orgError && (
            <div className="absolute top-3 left-4 right-4 md:left-6 md:right-auto bg-red-950/90 border border-red-500/50 text-red-300 px-3.5 py-2 rounded-lg shadow-2xl backdrop-blur flex items-center gap-2.5 z-10 font-mono text-xs max-w-md">
              <span className="w-2 h-2 rounded-full shrink-0 bg-red-500" />
              <span>{orgError}</span>
            </div>
          )}
          {!orgError && orgUnits.length === 0 && (
            <div className="absolute top-3 left-4 right-4 md:left-6 md:right-auto bg-[#181517]/95 border border-stone-700/80 text-stone-300 px-3.5 py-2 rounded-lg shadow-2xl backdrop-blur flex items-center gap-2.5 z-10 font-mono text-xs max-w-md">
              <span className="w-2 h-2 rounded-full shrink-0 bg-stone-400 animate-pulse" />
              <span>Carregando organograma do IFFar...</span>
            </div>
          )}

          {/* Active Status Banner */}
          {activeStatusMsg && (
            <div className="absolute top-3 left-4 right-4 md:left-6 md:right-auto bg-[#181517]/95 border border-amber-500/40 text-amber-300 px-3.5 py-2 rounded-lg shadow-2xl backdrop-blur flex items-center gap-2.5 z-10 font-mono text-xs max-w-md">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${loading ? "bg-amber-400 animate-ping" : "bg-emerald-400"}`}
              />
              <span className="truncate">{activeStatusMsg}</span>
            </div>
          )}
        </main>

        {/* RIGHT SIDEBAR */}
        <aside
          className={`${rightPanelCollapsed ? "w-10" : "w-80 md:w-96"} shrink-0 bg-[#181517] border-l border-[#2d262a] flex flex-col transition-all duration-300 z-10 overflow-hidden`}
        >
          <div className="p-3 border-b border-[#2d262a] flex items-center justify-between shrink-0">
            {!rightPanelCollapsed && (
              <div className="truncate">
                <h2 className="text-xs font-mono font-bold text-amber-500 uppercase tracking-widest truncate">
                  HEADQUARTERS
                </h2>
                <p className="text-[10px] text-stone-400 mt-0.5 truncate">
                  Monitor outputs, runs, and schedules.
                </p>
              </div>
            )}
            <button
              onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
              className="text-[11px] font-mono text-stone-400 hover:text-amber-400 p-1 rounded transition-colors shrink-0"
            >
              {rightPanelCollapsed ? "◀" : "COLLAPSE HQ ▶"}
            </button>
          </div>

          {!rightPanelCollapsed && (
            <>
              <div className="flex border-b border-[#2d262a] bg-[#120f11] shrink-0">
                {(["INBOX", "HISTORY", "PLAYBOOKS"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-2 text-xs font-mono font-bold border-b-2 transition-colors ${
                      activeTab === tab
                        ? "border-amber-500 text-amber-400 bg-[#181517]"
                        : "border-transparent text-stone-500 hover:text-stone-300"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-3">
                {/* PLAYBOOKS TAB */}
                {activeTab === "PLAYBOOKS" && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-stone-400 uppercase tracking-wider">
                        PLAYBOOKS
                      </span>
                      <button
                        onClick={() =>
                          handleExecutePrompt("Revisão de rotina institucional")
                        }
                        className="text-[10px] font-mono bg-[#282125] text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded hover:bg-amber-500/20 transition-colors"
                      >
                        REFRESH
                      </button>
                    </div>

                    <div className="bg-[#120f11] p-3 rounded-xl border border-[#2d262a] flex flex-col gap-2">
                      <span className="text-xs font-bold text-stone-300">
                        Nova Solicitação em Linguagem Natural
                      </span>
                      <textarea
                        rows={2}
                        className="w-full bg-[#1c171a] border border-[#382e34] rounded-lg p-2 text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500 resize-none font-mono"
                        placeholder="Ex: Solicitar relatório do Campus Panambi..."
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                      />
                      <button
                        onClick={() => {
                          handleExecutePrompt(customPrompt);
                          setCustomPrompt("");
                        }}
                        disabled={loading || !customPrompt}
                        className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 disabled:bg-stone-800 disabled:text-stone-600 text-stone-950 font-mono font-bold text-xs rounded-lg transition-colors shadow flex items-center justify-center gap-1.5"
                      >
                        <span>🚀</span>
                        <span>EXECUTAR VIA NIRVANA</span>
                      </button>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      <div className="bg-[#120f11] p-2.5 rounded-xl border border-[#2d262a] hover:border-amber-500/40 transition-colors group">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-stone-200 group-hover:text-amber-400 truncate">
                            RELATÓRIO EXTENSÃO PANAMBI
                          </span>
                          <button
                            onClick={() =>
                              handleExecutePrompt(
                                "Elaborar relatório de projetos de extensão para o Campus Panambi.",
                              )
                            }
                            className="text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded hover:bg-amber-500 hover:text-stone-950 transition-colors shrink-0"
                          >
                            RODAR
                          </button>
                        </div>
                        <p className="text-[10px] text-stone-400">
                          Encaminhado à Pró-Reitoria de Extensão e direcionado
                          ao Campus Panambi.
                        </p>
                      </div>

                      <div className="bg-[#120f11] p-2.5 rounded-xl border border-[#2d262a] hover:border-amber-500/40 transition-colors group">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-stone-200 group-hover:text-amber-400 truncate">
                            FISCALIZAÇÃO DE CONTRATO IN 05
                          </span>
                          <button
                            onClick={() =>
                              handleExecutePrompt(
                                "Fiscalizar o contrato de limpeza do Campus Frederico Westphalen (IN 05/2017).",
                              )
                            }
                            className="text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded hover:bg-amber-500 hover:text-stone-950 transition-colors shrink-0"
                          >
                            RODAR
                          </button>
                        </div>
                        <p className="text-[10px] text-stone-400">
                          Encaminhado à Pró-Reitoria de Administração (Diretoria
                          de Compras, Licitações e Contratos) e executado no
                          Campus Frederico Westphalen.
                        </p>
                      </div>

                      <div className="bg-[#120f11] p-2.5 rounded-xl border border-[#2d262a] hover:border-amber-500/40 transition-colors group">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-stone-200 group-hover:text-amber-400 truncate">
                            MINUTA DE PPC DE CURSO
                          </span>
                          <button
                            onClick={() =>
                              handleExecutePrompt(
                                "Elaborar minuta do PPC (projeto pedagógico de curso) para revisão curricular na Pró-Reitoria de Ensino.",
                              )
                            }
                            className="text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded hover:bg-amber-500 hover:text-stone-950 transition-colors shrink-0"
                          >
                            RODAR
                          </button>
                        </div>
                        <p className="text-[10px] text-stone-400">
                          Encaminhado à Pró-Reitoria de Ensino para revisão de
                          matrizes curriculares.
                        </p>
                      </div>

                      <div className="bg-[#120f11] p-2.5 rounded-xl border border-amber-500/30 hover:border-amber-500/60 transition-colors group">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-amber-300 truncate">
                            NOVO PDI INSTITUCIONAL
                          </span>
                          <button
                            onClick={() =>
                              handleExecutePrompt(
                                "Elaborar o novo Plano de Desenvolvimento Institucional (PDI) do IFFar, alinhado às tendências de inteligência artificial, ensino híbrido, inclusão digital e sustentabilidade.",
                              )
                            }
                            className="text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded hover:bg-amber-500 hover:text-stone-950 transition-colors shrink-0"
                          >
                            RODAR
                          </button>
                        </div>
                        <p className="text-[10px] text-stone-400">
                          Encaminhado à Pró-Reitoria de Desenvolvimento
                          Institucional (Art. 21) → Diretoria de Planejamento e
                          Desenvolvimento Institucional → Coordenação de
                          Avaliação Institucional.
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {/* INBOX TAB */}
                {activeTab === "INBOX" && (
                  <div className="flex flex-col gap-2.5">
                    <span className="text-[10px] font-mono text-stone-400 uppercase tracking-wider">
                      ENTREGAS & ARTEFATOS GERADOS
                    </span>

                    {inboxItems.length === 0 ? (
                      <p className="text-xs text-stone-500 font-mono py-4">
                        Nenhum artefato gerado ainda.
                      </p>
                    ) : (
                      inboxItems.map((item) => (
                        <div
                          key={item.id}
                          className="bg-[#120f11] p-3 rounded-xl border border-[#2d262a] flex flex-col gap-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-amber-500 font-bold">
                              {item.date}
                            </span>
                            <span className="text-[10px] font-mono text-emerald-400">
                              ● GERADO
                            </span>
                          </div>
                          <h3 className="text-xs font-bold text-stone-200">
                            {item.title}
                          </h3>
                          <p className="text-[10px] text-stone-400">
                            {item.summary}
                          </p>
                          <button
                            onClick={() => setSelectedArtifact(item)}
                            className="mt-1 flex items-center justify-center gap-1.5 py-1.5 bg-amber-500/10 hover:bg-amber-500 hover:text-stone-950 text-amber-400 border border-amber-500/30 rounded text-xs font-mono font-bold transition-all shadow"
                          >
                            <span>📄</span>
                            <span>LEITURA / ABRIR ARTEFATO</span>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* HISTORY TAB */}
                {activeTab === "HISTORY" && (
                  <div className="flex flex-col gap-2.5 font-mono text-xs text-stone-400">
                    <span className="text-[10px] font-mono text-stone-400 uppercase tracking-wider">
                      EXECUÇÕES DESTA SESSÃO
                    </span>
                    {historyItems.length === 0 ? (
                      <p className="text-xs text-stone-500 font-mono py-4">
                        Nenhuma execução realizada ainda nesta sessão.
                      </p>
                    ) : (
                      historyItems.map((h) => (
                        <div
                          key={h.id}
                          className="bg-[#120f11] p-3 rounded-xl border border-[#2d262a] flex flex-col gap-1 text-[10px]"
                        >
                          <div
                            className={h.success ? "text-emerald-400" : "text-red-400"}
                          >
                            [{h.time}] {h.success ? "✔ concluído" : "✖ falhou"} · ticket{" "}
                            {h.id}
                          </div>
                          <div className="text-stone-300">{h.prompt}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </aside>
      </div>

      {/* ARTIFACT READER MODAL */}
      <ArtifactViewerModal
        item={selectedArtifact}
        onClose={() => setSelectedArtifact(null)}
      />
    </div>
  );
}
