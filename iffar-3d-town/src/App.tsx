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
// GEOGRAFIA REAL DO RIO GRANDE DO SUL
//
// Coordenadas reais (lat, long) da Reitoria (Santa Maria) e dos 13 campi,
// projetadas em um plano (x, z) equirretangular centrado na região onde o
// IFFar atua. O contorno do estado (RS_OUTLINE) vem do shapefile público do
// IBGE (via github.com/giuliano-macedo/geodata-br-states), simplificado por
// Douglas-Peucker e projetado com a mesma transformação — por isso os
// prédios caem no lugar geograficamente certo dentro do contorno real do RS,
// não em posições arbitrárias.
// ---------------------------------------------------------------------------

// nome (sem "Campus ") -> posição real no plano (lat/long projetadas com
// centro em -28.5715,-55.2411 e escala 10.29 un/grau de longitude,
// 11.55 un/grau de latitude — a mesma transformação usada no contorno)
const RS_CITY_COORDS: Record<string, [number, number]> = {
  Reitoria: [14.83, 12.84],
  Alegrete: [-5.66, 14.0],
  "Frederico Westphalen": [19.0, -14.0],
  Jaguari: [5.67, 10.69],
  "Júlio de Castilhos": [16.04, 7.57],
  Panambi: [17.9, -3.22],
  "Santa Rosa": [7.82, -8.09],
  Santiago: [3.85, 7.16],
  "Santo Augusto": [15.06, -8.32],
  "Santo Ângelo": [10.2, -3.33],
  "São Borja": [-7.85, 1.03],
  "São Luiz Gonzaga": [2.88, -1.89],
  "São Vicente do Sul": [5.91, 13.03],
  Uruguaiana: [-19.0, 13.67],
};

// Contorno simplificado do RS (76 pontos), mesma projeção acima.
const RS_OUTLINE: [number, number][] = [
  [56.89, 8.71], [45.98, 29.36], [32.56, 41.7], [33.2, 38.89], [32.2, 37.21],
  [34.87, 38.06], [40.92, 33.59], [41.93, 28.76], [46.7, 25.11], [46.54, 20.56],
  [48.01, 22.06], [47.79, 18.75], [44.36, 21.53], [40.59, 16.5], [40.61, 20.01],
  [42.66, 20.71], [40.56, 22.95], [40.73, 25.88], [39.89, 23.81], [39.1, 29.06],
  [34.05, 31.75], [33.03, 36.04], [31.02, 36.73], [30.77, 38.15], [31.98, 38.71],
  [32.18, 38.94], [32.18, 39.08], [31.8, 38.76], [31.1, 39.13], [30.79, 40.19],
  [32.03, 39.12], [32.49, 41.72], [30.19, 43.77], [26.87, 52.48], [18.97, 59.83],
  [17.54, 58.64], [18.67, 52.76], [20.36, 52.41], [21.75, 48.76], [25.62, 49.55],
  [27.32, 45.68], [26.94, 41.26], [22.19, 47.19], [19.06, 46.38], [15.39, 40.51],
  [6.74, 33.32], [0.02, 31.06], [-3.47, 26.12], [-7.91, 28.99], [-8.05, 25.58],
  [-16.1, 17.71], [-18.82, 17.5], [-20.34, 19.85], [-24.72, 18.73], [-12.11, 5.82],
  [-6.54, -2.42], [-4.69, -1.68], [-5.46, -3.79], [2.12, -8.23], [4.38, -11.98],
  [9.85, -12.98], [14.04, -16.69], [16.45, -15.6], [19.21, -17.1], [19.86, -15.63],
  [22.76, -17.22], [23.29, -15.59], [31.63, -14.99], [42.73, -8.54], [47.49, -2.08],
  [56.34, -1.29], [57.08, 0.62], [54.59, 1.81], [54.31, 6.31], [52.12, 7.83],
  [56.89, 8.71],
];

function cityKeyFromName(nome: string): string {
  return nome.replace(/^Campus\s+/i, "").trim();
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
// DYNAMIC CAMERA CONTROLLER
// ---------------------------------------------------------------------------

// Câmera "drone": quando o agente ativo muda de PRÉDIO (Reitoria <-> campus,
// ou de um campus para outro), a câmera corta para uma posição de aproximação
// bem alta acima do novo prédio (mudança de cenário) e então desce em zoom
// até o escritório — em vez de sobrevoar em linha reta por cima do mapa
// inteiro. Trocar de agente DENTRO do mesmo prédio continua um lerp suave.
const CameraController = ({
  activeAgentId,
  agents,
  activeLocationId,
  onSceneChange,
}: {
  activeAgentId: string | null;
  agents: AgentNode[];
  activeLocationId: string | null;
  onSceneChange: () => void;
}) => {
  const controlsRef = useRef<any>(null);
  const lastLocationRef = useRef<string | null>(null);

  useFrame((state, delta) => {
    if (!controlsRef.current) return;

    if (activeAgentId) {
      const agent = agents.find((a) => a.id === activeAgentId);
      if (agent) {
        if (activeLocationId && lastLocationRef.current !== activeLocationId) {
          const wasAnotherLocation = lastLocationRef.current !== null;
          lastLocationRef.current = activeLocationId;
          if (wasAnotherLocation) {
            // mudança de cenário: corta para uma aproximação alta acima do
            // novo prédio antes de descer, em vez de deslizar por cima do
            // mapa inteiro de um campus para o outro.
            state.camera.position.set(agent.pos[0] + 3, 26, agent.pos[2] + 3);
            controlsRef.current.target.set(agent.pos[0], 2, agent.pos[2]);
            onSceneChange();
          }
        }

        const targetPos = new THREE.Vector3(agent.pos[0], 1.2, agent.pos[2]);
        controlsRef.current.target.lerp(targetPos, delta * 3.2);

        // zoom "drone": desce quase em cima do prédio, câmera baixa e perto
        const desiredCamPos = new THREE.Vector3(
          agent.pos[0] + 6,
          6.5,
          agent.pos[2] + 6,
        );
        state.camera.position.lerp(desiredCamPos, delta * 3.2);
      }
    } else {
      lastLocationRef.current = null;
      const centerTarget = new THREE.Vector3(0, 0, 0);
      controlsRef.current.target.lerp(centerTarget, delta * 2.2);

      const overviewCamPos = new THREE.Vector3(46, 48, 46);
      state.camera.position.lerp(overviewCamPos, delta * 2.2);
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
      minDistance={4}
      maxDistance={120}
    />
  );
};

// ---------------------------------------------------------------------------
// 3D SCENERY COMPONENTS
// ---------------------------------------------------------------------------

// Terreno estilizado do Rio Grande do Sul: o contorno real do estado
// (RS_OUTLINE, do IBGE) extrudado como um "tabuleiro", para que os prédios
// caiam na posição geográfica certa dentro da silhueta reconhecível do RS.
const RSTerrain = () => {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    RS_OUTLINE.forEach(([x, z], i) => {
      if (i === 0) shape.moveTo(x, z);
      else shape.lineTo(x, z);
    });
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.6,
      bevelEnabled: true,
      bevelThickness: 0.15,
      bevelSize: 0.15,
      bevelSegments: 2,
    });
  }, []);

  const edgePoints = useMemo(
    () => RS_OUTLINE.map(([x, z]) => new THREE.Vector3(x, 0.62, z)),
    [],
  );

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <mesh geometry={geometry} receiveShadow castShadow rotation={[0, 0, 0]}>
        <meshStandardMaterial color="#2f6b3a" roughness={0.85} />
      </mesh>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array(edgePoints.flatMap((p) => [p.x, p.y, p.z])), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#f59e0b" linewidth={2} />
      </line>
    </group>
  );
};

// Prédio estilizado (verde e vermelho) de um campus ou da Reitoria,
// posicionado na coordenada geográfica real. `scale` destaca a Reitoria.
const CampusBuilding = ({
  position,
  label,
  isActive,
  scale = 1,
  onClick,
}: {
  position: [number, number, number];
  label: string;
  isActive: boolean;
  scale?: number;
  onClick?: () => void;
}) => {
  return (
    <group
      position={position}
      scale={scale}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {/* base do prédio */}
      <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 2.2, 2.6]} />
        <meshStandardMaterial color="#166534" roughness={0.6} />
      </mesh>
      {/* faixa/aceso vermelho */}
      <mesh position={[0, 0.35, 1.32]}>
        <boxGeometry args={[3.2, 0.6, 0.04]} />
        <meshStandardMaterial color="#b91c1c" />
      </mesh>
      {/* telhado vermelho em duas águas */}
      <mesh position={[0, 2.55, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[2.5, 1.4, 4]} />
        <meshStandardMaterial color="#dc2626" roughness={0.5} />
      </mesh>
      {/* bandeirinha de destaque quando ativo */}
      {isActive && (
        <mesh position={[0, 4.2, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 1.6]} />
          <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.6} />
        </mesh>
      )}

      <Html position={[0, 3.9, 0]} center distanceFactor={26} style={{ pointerEvents: "none" }}>
        <div
          className={`px-2 py-0.5 rounded-md border text-[10px] font-mono font-bold whitespace-nowrap shadow-lg ${
            isActive
              ? "bg-amber-500 text-stone-950 border-amber-300"
              : "bg-[#181517]/90 text-emerald-300 border-emerald-700/60"
          }`}
        >
          🏛️ {label}
        </div>
      </Html>
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
  showLabel = true,
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
  showLabel?: boolean;
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

      {showLabel && (
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
            <span className="font-mono tracking-wide whitespace-nowrap max-w-[260px] truncate">
              {name}
            </span>
          </div>
        </div>
      </Html>
      )}
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
  // "Corte" de cena: um flash rápido quando a câmera pula de um prédio para
  // outro (Reitoria <-> campus, ou campus -> campus), para reforçar a
  // sensação de mudança de cenário em vez de um sobrevoo contínuo.
  const [sceneFlash, setSceneFlash] = useState(false);
  const triggerSceneFlash = () => {
    setSceneFlash(true);
    setTimeout(() => setSceneFlash(false), 260);
  };

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
      // desse prédio no RS, nunca de um layout arbitrário em anel.
      const locationId = physicalLocationId(unit.id, unitsById);
      const locationUnit = unitsById.get(locationId);
      const cityKey = locationUnit ? cityKeyFromName(locationUnit.nome) : "Reitoria";
      const [baseX, baseZ] = RS_CITY_COORDS[cityKey] ?? [0, 0];

      let pos: [number, number, number];
      if (isReitoria || isCampusGabinete) {
        // marcador principal do prédio: exatamente na coordenada da cidade
        pos = [baseX, 0, baseZ];
      } else {
        // demais agentes (Pró-Reitorias na Reitoria, diretorias/coordenações
        // expandidas num campus): espalhados perto do prédio, por um ângulo
        // estável derivado do próprio id (nunca hardcoded)
        const angle = hashAngle(unit.id) * Math.PI * 2;
        const radius = 3.2 + (hashAngle(unit.id + "r") % 1) * 1.6;
        pos = [baseX + Math.cos(angle) * radius, 0, baseZ + Math.sin(angle) * radius];
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
  const mapLocations = useMemo(() => {
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
        pos: [x, 0, z] as [number, number, number],
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

  const activeBuildingPos = useMemo(() => {
    if (!activeLocationId) return null;
    return mapLocations.find((l) => l.id === activeLocationId)?.pos ?? null;
  }, [activeLocationId, mapLocations]);

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

        {/* CENTER 3D VIEWPORT CANVAS */}
        <main className="flex-1 relative bg-[#120f11] overflow-hidden">
          {/* Flash de corte de cena — sobe a opacidade rapidamente e cai,
              simulando um corte de câmera ao mudar de prédio/campus */}
          <div
            className={`pointer-events-none absolute inset-0 z-30 bg-white transition-opacity duration-150 ${
              sceneFlash ? "opacity-80" : "opacity-0"
            }`}
          />
          <Canvas
            camera={{ position: [46, 48, 46], fov: 45, near: 0.1, far: 1000 }}
            shadows
          >
            <color attach="background" args={["#120f11"]} />
            <ambientLight intensity={1.2} />
            <directionalLight
              position={[20, 30, 15]}
              intensity={1.8}
              castShadow
              shadow-mapSize={[2048, 2048]}
              shadow-camera-left={-35}
              shadow-camera-right={35}
              shadow-camera-top={35}
              shadow-camera-bottom={-35}
              color="#fffcf7"
            />
            <directionalLight
              position={[-15, 20, -10]}
              intensity={0.6}
              color="#dbeafe"
            />

            <RSTerrain />

            {mapLocations.map((loc) => (
              <CampusBuilding
                key={loc.id}
                position={loc.pos}
                label={cityKeyFromName(loc.nome)}
                isActive={activeLocationId === loc.id}
                scale={loc.id === "1.1" ? 1.25 : 1}
                onClick={() => {
                  if (loc.id !== "1.1") {
                    setExpandedCampusId((prev) => (prev === loc.id ? null : loc.id));
                  }
                  setActiveAgentId((prev) =>
                    prev === loc.primaryAgentId ? null : loc.primaryAgentId,
                  );
                }}
              />
            ))}

            {activeBuildingPos && (
              <group>
                <ConferenceTable
                  position={[activeBuildingPos[0] - 2.6, 0, activeBuildingPos[2] - 2.2]}
                />
                <LoungeArea
                  position={[activeBuildingPos[0] + 2.6, 0, activeBuildingPos[2] - 2.2]}
                />
                <WorkstationDesk
                  position={[activeBuildingPos[0] - 1.2, 0, activeBuildingPos[2] + 2.6]}
                  rotation={Math.PI / 2}
                />
                <WorkstationDesk
                  position={[activeBuildingPos[0] + 1.2, 0, activeBuildingPos[2] + 2.6]}
                  rotation={-Math.PI / 2}
                />
              </group>
            )}

            {agents.map((agent) => {
              const ownerCampus = campusRoots.find((c) =>
                (childrenByParent.get(c.id) ?? []).some((u) => u.id === agent.id),
              );
              const competencia = competenciaByName.get(normalizeName(agent.title));
              // Na visão geral (nenhum prédio em foco) só os pins dos 14
              // prédios aparecem. Ao focar um prédio (drone-zoom), rotula
              // somente os agentes daquele prédio — evita poluir a cena com
              // dezenas de rótulos de prédios distantes fora do foco.
              const showLabel =
                activeLocationId !== null &&
                physicalLocationId(agent.id, unitsById) === activeLocationId;
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
                  showLabel={showLabel}
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

            <CameraController
              activeAgentId={activeAgentId}
              agents={agents}
              activeLocationId={activeLocationId}
              onSceneChange={triggerSceneFlash}
            />
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
