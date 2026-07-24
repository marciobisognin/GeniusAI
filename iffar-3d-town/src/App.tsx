import { useState, useEffect, useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { parse as parseYaml } from "yaml";
import * as THREE from "three";

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
  pos: [number, number, number];
  cargo?: string;
  funcao?: string;
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
// mesmo id sempre cai no mesmo ângulo do anel, então o layout não "pula"
// entre carregamentos.
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

// ---------------------------------------------------------------------------
// DYNAMIC CAMERA CONTROLLER
// ---------------------------------------------------------------------------

const CameraController = ({
  activeAgentId,
  agents,
}: {
  activeAgentId: string | null;
  agents: AgentNode[];
}) => {
  const controlsRef = useRef<any>(null);

  useFrame((state, delta) => {
    if (!controlsRef.current) return;

    if (activeAgentId) {
      const agent = agents.find((a) =>
        activeAgentId.toLowerCase().includes(a.id.toLowerCase()),
      );
      if (agent) {
        const targetPos = new THREE.Vector3(
          agent.pos[0],
          agent.pos[1] + 0.8,
          agent.pos[2],
        );
        controlsRef.current.target.lerp(targetPos, delta * 3.5);

        const desiredCamPos = new THREE.Vector3(
          agent.pos[0] + 12,
          agent.pos[1] + 12,
          agent.pos[2] + 12,
        );
        state.camera.position.lerp(desiredCamPos, delta * 3.5);
      }
    } else {
      const centerTarget = new THREE.Vector3(0, 0, 0);
      controlsRef.current.target.lerp(centerTarget, delta * 2.5);

      const overviewCamPos = new THREE.Vector3(22, 22, 22);
      state.camera.position.lerp(overviewCamPos, delta * 2.5);
    }

    controlsRef.current.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableRotate={true}
      enablePan={true}
      maxPolarAngle={Math.PI / 2.1}
      minDistance={6}
      maxDistance={70}
    />
  );
};

// ---------------------------------------------------------------------------
// 3D SCENERY COMPONENTS
// ---------------------------------------------------------------------------

const OfficeFloorAndWalls = () => {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[32, 22]} />
        <meshStandardMaterial color="#c4b29c" roughness={0.5} />
      </mesh>

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
      >
        <planeGeometry args={[32.6, 22.6]} />
        <meshStandardMaterial color="#2d2421" />
      </mesh>

      <mesh position={[0, 2.0, -11]} receiveShadow castShadow>
        <boxGeometry args={[32, 4.0, 0.4]} />
        <meshStandardMaterial color="#4a4245" />
      </mesh>
      <mesh position={[0, 4.1, -11]}>
        <boxGeometry args={[32.2, 0.2, 0.5]} />
        <meshStandardMaterial color="#6b5f63" />
      </mesh>

      <mesh position={[-16, 2.0, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.4, 4.0, 22]} />
        <meshStandardMaterial color="#4a4245" />
      </mesh>

      <mesh position={[-5, 1.8, -4]} receiveShadow castShadow>
        <boxGeometry args={[0.3, 3.6, 14]} />
        <meshStandardMaterial color="#4a4245" />
      </mesh>
      <mesh position={[-5, 2.2, -4]}>
        <boxGeometry args={[0.32, 2.0, 7]} />
        <meshPhysicalMaterial
          color="#94a3b8"
          transmission={0.8}
          transparent
          opacity={0.35}
          roughness={0.1}
        />
      </mesh>
    </group>
  );
};

const WorkstationDesk = ({
  position,
  rotation = 0,
}: {
  position: [number, number, number];
  rotation?: number;
}) => {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.65, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.08, 0.9]} />
        <meshStandardMaterial color="#7a4e2b" roughness={0.4} />
      </mesh>
      <mesh position={[-0.7, 0.32, -0.35]} castShadow>
        <boxGeometry args={[0.07, 0.64, 0.07]} />
        <meshStandardMaterial color="#1a1817" />
      </mesh>
      <mesh position={[0.7, 0.32, -0.35]} castShadow>
        <boxGeometry args={[0.07, 0.64, 0.07]} />
        <meshStandardMaterial color="#1a1817" />
      </mesh>
      <mesh position={[-0.7, 0.32, 0.35]} castShadow>
        <boxGeometry args={[0.07, 0.64, 0.07]} />
        <meshStandardMaterial color="#1a1817" />
      </mesh>
      <mesh position={[0.7, 0.32, 0.35]} castShadow>
        <boxGeometry args={[0.07, 0.64, 0.07]} />
        <meshStandardMaterial color="#1a1817" />
      </mesh>

      <mesh position={[-0.28, 1.02, -0.18]} rotation={[0, 0.08, 0]} castShadow>
        <boxGeometry args={[0.55, 0.35, 0.03]} />
        <meshStandardMaterial color="#141213" />
      </mesh>
      <mesh position={[-0.28, 1.02, -0.16]} rotation={[0, 0.08, 0]}>
        <planeGeometry args={[0.5, 0.3]} />
        <meshBasicMaterial color="#0284c7" />
      </mesh>
      <mesh position={[0.28, 1.02, -0.18]} rotation={[0, -0.08, 0]} castShadow>
        <boxGeometry args={[0.55, 0.35, 0.03]} />
        <meshStandardMaterial color="#141213" />
      </mesh>
      <mesh position={[0.28, 1.02, -0.16]} rotation={[0, -0.08, 0]}>
        <planeGeometry args={[0.5, 0.3]} />
        <meshBasicMaterial color="#0f766e" />
      </mesh>

      <group position={[0, 0, 0.75]}>
        <mesh position={[0, 0.42, 0]} castShadow>
          <boxGeometry args={[0.48, 0.07, 0.45]} />
          <meshStandardMaterial color="#2d2a33" />
        </mesh>
        <mesh position={[0, 0.72, 0.18]} castShadow>
          <boxGeometry args={[0.44, 0.55, 0.05]} />
          <meshStandardMaterial color="#2d2a33" />
        </mesh>
      </group>
    </group>
  );
};

const ConferenceTable = ({
  position,
}: {
  position: [number, number, number];
}) => {
  return (
    <group position={position}>
      <mesh position={[0, 0.68, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.8, 1.8, 0.08, 6]} />
        <meshStandardMaterial color="#8a552e" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.32, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.7, 0.64]} />
        <meshStandardMaterial color="#241913" />
      </mesh>
      {[0, 60, 120, 180, 240, 300].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const cx = Math.cos(rad) * 2.2;
        const cz = Math.sin(rad) * 2.2;
        return (
          <group
            key={i}
            position={[cx, 0, cz]}
            rotation={[0, -rad - Math.PI / 2, 0]}
          >
            <mesh position={[0, 0.4, 0]} castShadow>
              <boxGeometry args={[0.42, 0.07, 0.42]} />
              <meshStandardMaterial color="#332f32" />
            </mesh>
            <mesh position={[0, 0.7, 0.16]} castShadow>
              <boxGeometry args={[0.38, 0.5, 0.05]} />
              <meshStandardMaterial color="#332f32" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

const LoungeArea = ({ position }: { position: [number, number, number] }) => {
  return (
    <group position={position}>
      <mesh position={[0, 0.32, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.35, 0.8]} />
        <meshStandardMaterial color="#222838" />
      </mesh>
      <mesh position={[0, 0.62, -0.3]} castShadow>
        <boxGeometry args={[2.4, 0.45, 0.2]} />
        <meshStandardMaterial color="#222838" />
      </mesh>
      <mesh position={[0, 0.22, 0.95]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.07, 0.5]} />
        <meshStandardMaterial color="#473424" />
      </mesh>
      <group position={[1.4, 0, -0.3]}>
        <mesh position={[0, 1.1, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 2.2]} />
          <meshStandardMaterial color="#d97706" />
        </mesh>
        <mesh position={[0, 2.1, 0]}>
          <coneGeometry args={[0.26, 0.35, 16]} />
          <meshStandardMaterial
            color="#fcd34d"
            emissive="#f59e0b"
            emissiveIntensity={0.9}
          />
        </mesh>
        <pointLight
          position={[0, 1.9, 0]}
          intensity={1.5}
          color="#f59e0b"
          distance={4}
        />
      </group>
    </group>
  );
};

// ---------------------------------------------------------------------------
// BLOCKY VOXEL AVATAR COMPONENT
// ---------------------------------------------------------------------------

const VoxelAvatar = ({
  name,
  color,
  position,
  isActive,
  currentMessage,
  cargo,
  funcao,
  competencia,
  onClick,
}: {
  name: string;
  color: string;
  position: [number, number, number];
  isActive: boolean;
  currentMessage?: string;
  cargo?: string;
  funcao?: string;
  competencia?: { artigo: number; resumo: string | null } | null;
  onClick?: () => void;
}) => {
  const avatarRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (avatarRef.current) {
      const t = state.clock.getElapsedTime();
      if (isActive) {
        avatarRef.current.position.y = position[1] + Math.sin(t * 8) * 0.06;
      } else {
        avatarRef.current.position.y = position[1] + Math.sin(t * 1.5) * 0.015;
      }
    }
  });

  return (
    <group
      ref={avatarRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <mesh position={[0, 1.35, 0]} castShadow>
        <boxGeometry args={[0.38, 0.38, 0.38]} />
        <meshStandardMaterial color="#fcd34d" />
      </mesh>
      <mesh position={[0, 1.55, 0.01]} castShadow>
        <boxGeometry args={[0.4, 0.1, 0.4]} />
        <meshStandardMaterial color="#2b1a0e" />
      </mesh>

      <mesh position={[0, 0.85, 0]} castShadow>
        <boxGeometry args={[0.4, 0.5, 0.24]} />
        <meshStandardMaterial color={color} />
      </mesh>

      <mesh position={[-0.1, 0.3, 0]} castShadow>
        <boxGeometry args={[0.16, 0.58, 0.2]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0.1, 0.3, 0]} castShadow>
        <boxGeometry args={[0.16, 0.58, 0.2]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>

      <Html
        position={[0, 1.85, 0]}
        center
        distanceFactor={20}
        zIndexRange={[5, 0]}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <div className="flex flex-col items-center">
          {isActive && currentMessage && (
            <div className="mb-1.5 bg-amber-400 text-slate-950 text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-xl border border-slate-900 flex items-center gap-1.5 animate-bounce font-mono whitespace-nowrap">
              <span>💭</span>
              <span>{currentMessage}</span>
            </div>
          )}

          {hovered && !isActive && (cargo || competencia) && (
            <div className="mb-1.5 max-w-[220px] bg-[#120f11]/95 text-stone-200 text-[10px] px-2.5 py-2 rounded-lg shadow-xl border border-amber-500/40 font-mono">
              <div className="font-bold text-amber-400 whitespace-normal">{name}</div>
              {cargo && (
                <div className="text-stone-400">
                  {cargo}
                  {funcao ? ` · ${funcao}` : ""}
                </div>
              )}
              {competencia && (
                <div className="mt-1 text-stone-300 whitespace-normal leading-snug">
                  Art. {competencia.artigo}
                  {competencia.resumo ? ` — ${competencia.resumo.slice(0, 140)}` : ""}
                </div>
              )}
            </div>
          )}

          <div
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[11px] font-bold shadow-lg transition-all duration-300 ${
              isActive
                ? "bg-amber-500 text-slate-950 border-amber-300 ring-2 ring-amber-500/40 scale-105"
                : "bg-[#181517]/95 text-stone-200 border-stone-700/80"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${isActive ? "bg-red-500 animate-ping" : "bg-emerald-400"}`}
            />
            <span className="font-mono tracking-wide whitespace-nowrap">
              {name}
            </span>
          </div>
        </div>
      </Html>
    </group>
  );
};

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

    const RING_RADIUS = campusRoots.length > 0 ? Math.min(6 + campusRoots.length * 0.35, 9.5) : 8;
    const CENTER_RADIUS = 3.2;
    let proIdx = 0;
    let campusIdx = 0;
    const positionById = new Map<string, [number, number, number]>();

    return list.map((unit) => {
      const isReitoria = unit.id === "1.1";
      const isCampusGabinete = campusRoots.some((c) => c.id === unit.parent);
      const isProReitoria = proReitorias.includes(unit);

      let pos: [number, number, number] = [0, 0, 0];
      if (isReitoria) {
        pos = [0, 0, 0];
      } else if (isProReitoria) {
        const angle = (proIdx / Math.max(proReitorias.length, 1)) * Math.PI * 2;
        pos = [
          Math.cos(angle) * CENTER_RADIUS,
          0,
          Math.sin(angle) * CENTER_RADIUS,
        ];
        proIdx++;
      } else if (isCampusGabinete) {
        const angle = (campusIdx / Math.max(campusRoots.length, 1)) * Math.PI * 2;
        pos = [
          Math.cos(angle) * RING_RADIUS,
          0,
          Math.sin(angle) * RING_RADIUS,
        ];
        campusIdx++;
      } else {
        // filhos expandidos de um campus: espalhados perto do gabinete pai,
        // por um ângulo estável derivado do próprio id (nunca hardcoded)
        const base = positionById.get(unit.parent ?? "") ?? [0, 0, 0];
        const angle = hashAngle(unit.id) * Math.PI * 2;
        pos = [base[0] + Math.cos(angle) * 2.6, 0, base[2] + Math.sin(angle) * 2.6];
      }

      const ownerCampus = campusRoots.find((c) => c.id === unit.parent);
      // "Gabinete Do(a) Diretor(a) Geral" se repete em todos os campi — na
      // cena e nos chips, o nome do campus identifica o prédio melhor do
      // que o nome genérico do cargo.
      const displayName = ownerCampus
        ? ownerCampus.nome.replace(/^Campus\s+/i, "")
        : unit.nome.split(" ").slice(0, 3).join(" ");

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
      positionById.set(unit.id, pos);
      return node;
    });
  }, [orgUnits, unitsById, childrenByParent, campusRoots, expandedCampusId, campusFilterId]);

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
              <span className="whitespace-nowrap">
                {agent.name.split(" ")[0]}
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

        {/* CENTER 3D VIEWPORT CANVAS */}
        <main className="flex-1 relative bg-[#120f11] overflow-hidden">
          <Canvas
            camera={{ position: [22, 22, 22], fov: 45, near: 0.1, far: 1000 }}
            shadows
          >
            <color attach="background" args={["#120f11"]} />
            <ambientLight intensity={1.2} />
            <directionalLight
              position={[20, 30, 15]}
              intensity={1.8}
              castShadow
              shadow-mapSize={[2048, 2048]}
              color="#fffcf7"
            />
            <directionalLight
              position={[-15, 20, -10]}
              intensity={0.6}
              color="#dbeafe"
            />
            <pointLight
              position={[0, 8, 0]}
              intensity={1.0}
              color="#fbbf24"
              distance={15}
            />

            <OfficeFloorAndWalls />

            <ConferenceTable position={[-7.5, 0, -4.5]} />
            <LoungeArea position={[7.5, 0, -4.5]} />
            <WorkstationDesk position={[0, 0, -2.2]} rotation={Math.PI / 2} />
            <WorkstationDesk position={[0, 0, 2.2]} rotation={-Math.PI / 2} />

            {agents.map((agent) => {
              const ownerCampus = campusRoots.find((c) =>
                (childrenByParent.get(c.id) ?? []).some((u) => u.id === agent.id),
              );
              const competencia = competenciaByName.get(normalizeName(agent.title));
              return (
                <VoxelAvatar
                  key={agent.id}
                  name={agent.name}
                  color={agent.color}
                  position={agent.pos}
                  isActive={activeAgentId === agent.id}
                  currentMessage={
                    activeAgentId === agent.id ? activeStatusMsg : undefined
                  }
                  cargo={agent.cargo}
                  funcao={agent.funcao}
                  competencia={competencia ?? null}
                  onClick={() => {
                    if (ownerCampus) {
                      setExpandedCampusId((prev) =>
                        prev === ownerCampus.id ? null : ownerCampus.id,
                      );
                    }
                    setActiveAgentId((prev) => (prev === agent.id ? null : agent.id));
                  }}
                />
              );
            })}

            <CameraController activeAgentId={activeAgentId} agents={agents} />
          </Canvas>

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
                            MINUTA PDI DE ENSINO
                          </span>
                          <button
                            onClick={() =>
                              handleExecutePrompt(
                                "Elaborar minuta pedagógica do novo PDI para a Pró-Reitoria de Ensino.",
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
