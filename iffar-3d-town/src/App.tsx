import React, { useState, useEffect, useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";

// Types
interface AgentNode {
  id: string;
  name: string;
  title: string;
  campus: string;
  color: string;
  pos: [number, number, number];
}

interface InboxItem {
  id: string;
  date: string;
  title: string;
  link: string;
  summary: string;
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
}: {
  name: string;
  color: string;
  position: [number, number, number];
  isActive: boolean;
  currentMessage?: string;
}) => {
  const avatarRef = useRef<THREE.Group>(null);

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
    <group ref={avatarRef} position={position}>
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

  // Organogram Agents positioned in 3D HQ
  const agents: AgentNode[] = useMemo(
    () => [
      {
        id: "unit-1-1-reit-oria",
        name: "Luke (Reitora)",
        title: "Gabinete da Reitoria",
        campus: "Reitoria",
        color: "#8b5cf6",
        pos: [-9, 0, -5],
      },
      {
        id: "unit-1-1-2-audit-oria-interna",
        name: "Allan (Auditoria)",
        title: "Auditoria Interna",
        campus: "Reitoria",
        color: "#10b981",
        pos: [-7, 0, -7],
      },
      {
        id: "unit-1-1-4-gabinete-do-a-reit-or-a-reit-or-a-cd-0001",
        name: "Ben (Gabinete)",
        title: "Chefe de Gabinete",
        campus: "Reitoria",
        color: "#06b6d4",
        pos: [1.5, 0, -5.5],
      },
      {
        id: "unit-1-1-16-pro-reit-oria-de-ensino-pro-reit-or-a-cd-0002",
        name: "Cory (Pro-Ensino)",
        title: "Pró-Reitoria Ensino",
        campus: "Reitoria",
        color: "#f97316",
        pos: [-1, 0, 1],
      },
      {
        id: "unit-1-1-18-pro-reit-oria-de-extens-ao-pro-reit-or-a-cd-0002",
        name: "Neviton (Pro-Extensao)",
        title: "Pró-Reitoria Extensão",
        campus: "Reitoria",
        color: "#ec4899",
        pos: [3.5, 0, 3.5],
      },
      {
        id: "unit-1-2-campus-alegrete",
        name: "Susie (Dir. Alegrete)",
        title: "Direção Campus Alegrete",
        campus: "Alegrete",
        color: "#84cc16",
        pos: [7.5, 0, 6],
      },
      {
        id: "unit-1-6-campus-panambi",
        name: "Marcos (Dir. Panambi)",
        title: "Direção Campus Panambi",
        campus: "Panambi",
        color: "#3b82f6",
        pos: [11, 0, 3],
      },
      {
        id: "unit-1-11-campus-sant-o-angel-o",
        name: "Carla (Dir. Santo Ângelo)",
        title: "Direção Campus Santo Ângelo",
        campus: "Santo Ângelo",
        color: "#ef4444",
        pos: [10, 0, -5],
      },
      {
        id: "unit-1-7-campus-santa-rosa",
        name: "Rafael (Dir. Santa Rosa)",
        title: "Direção Campus Santa Rosa",
        campus: "Santa Rosa",
        color: "#eab308",
        pos: [7.5, 0, -8],
      },
    ],
    [],
  );

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
        data.sequence.forEach((step: any, idx: number) => {
          setTimeout(() => {
            const targetAgent =
              agents.find((a) => a.id === step.to || a.id === step.from) ||
              agents[idx % agents.length];

            setActiveAgentId(targetAgent.id);
            setActiveStatusMsg(`[${targetAgent.name}] ${step.action}`);

            if (idx === data.sequence.length - 1) {
              setTimeout(() => {
                setLoading(false);

                setActiveAgentId(null);
                setActiveStatusMsg("Orquestração Concluída com Sucesso!");

                if (data.artifacts && data.artifacts.length > 0) {
                  const newInbox: InboxItem = {
                    id: `ticket-${Date.now().toString().slice(-4)}`,
                    date: "AGORA",
                    title: `Resultado: ${promptText.substring(0, 30)}...`,
                    link: data.artifacts[0],
                    summary:
                      "Artefato gerado e despachado pelo organograma do IFFar.",
                  };
                  setInboxItems((prev) => [newInbox, ...prev]);
                  setActiveTab("INBOX");
                  // Automatically open the new artifact in the reader modal!
                  setSelectedArtifact(newInbox);
                }
              }, 3500);
            }
          }, step.delay);
        });
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
        </div>

        {/* Center Agent Chips Bar */}
        <div className="flex-1 flex items-center justify-center gap-1.5 px-4 overflow-x-auto no-scrollbar">
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() =>
                setActiveAgentId(activeAgentId === agent.id ? null : agent.id)
              }
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

        {/* Right Gateway Status */}
        <div className="shrink-0 flex items-center">
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-md border border-emerald-800/50 flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            GATEWAY 4000
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
            <WorkstationDesk position={[-1, 0, 1]} />
            <WorkstationDesk position={[3.5, 0, 3.5]} />
            <WorkstationDesk position={[7.5, 0, 6]} />
            <WorkstationDesk position={[11, 0, 3]} />
            <WorkstationDesk position={[10, 0, -5]} />
            <WorkstationDesk position={[7.5, 0, -8]} />

            {agents.map((agent) => (
              <VoxelAvatar
                key={agent.id}
                name={agent.name}
                color={agent.color}
                position={agent.pos}
                isActive={activeAgentId === agent.id}
                currentMessage={
                  activeAgentId === agent.id ? activeStatusMsg : undefined
                }
              />
            ))}

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
                            AUDITORIA DE CONTRATO IN 05
                          </span>
                          <button
                            onClick={() =>
                              handleExecutePrompt(
                                "Fiscalização e Análise de Contratos Federais conforme IN 05/2017.",
                              )
                            }
                            className="text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded hover:bg-amber-500 hover:text-stone-950 transition-colors shrink-0"
                          >
                            RODAR
                          </button>
                        </div>
                        <p className="text-[10px] text-stone-400">
                          Encaminhado à Auditoria Interna e fiscalizado no
                          Campus Santo Ângelo.
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
                      LOGS DE ORQUESTRAÇÃO
                    </span>
                    <div className="bg-[#120f11] p-3 rounded-xl border border-[#2d262a] flex flex-col gap-2 text-[10px]">
                      <div className="text-emerald-400">
                        [11:42:01] Reitoria ➔ Auditoria Interna
                      </div>
                      <div className="text-stone-300">
                        Despacho de instrução legal IN 05/2017 concluído.
                      </div>
                      <div className="text-emerald-400">
                        [11:42:08] Auditoria Interna ➔ Campus Santo Ângelo
                      </div>
                      <div className="text-stone-300">
                        Solicitação de comprovante fiscal e relatório.
                      </div>
                    </div>
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
