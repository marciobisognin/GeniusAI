import { deriveTechTree } from "../simulationInsights";
import { CIV_COLOR, CIV_LABEL, type CivId, type World } from "../types";

interface Props {
  world: World | null;
  selected: CivId;
}

const BRANCH_LABEL: Record<string, string> = {
  agricultura: "Agricultura",
  militar: "Militar",
  cultura: "Cultura",
  comércio: "Comércio",
  ciência: "Ciência",
};

export function TechTreePanel({ world, selected }: Props) {
  const civ = world?.civilizations[selected];
  const tree = deriveTechTree(civ);
  const branches = [...new Set(tree.map((node) => node.branch))];
  return (
    <section className="living-card tech-tree-card" style={{ "--civ": CIV_COLOR[selected] } as React.CSSProperties}>
      <div className="living-card-head">
        <div>
          <p className="eyebrow">Árvore tecnológica</p>
          <h2>{CIV_LABEL[selected]}</h2>
        </div>
        <span className="soft-chip">{civ?.tech.length ?? 0} desbloqueadas</span>
      </div>
      <div className="tech-branches">
        {branches.map((branch) => (
          <div className="tech-branch" key={branch}>
            <strong>{BRANCH_LABEL[branch]}</strong>
            <div className="tech-nodes">
              {tree.filter((node) => node.branch === branch).map((node) => (
                <span key={node.id} className={`${node.unlocked ? "unlocked" : ""} ${node.active ? "active" : ""}`}>
                  {node.label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
