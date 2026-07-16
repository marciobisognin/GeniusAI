import { Network } from "lucide-react";
import { buildTree, type OrgNode } from "@/lib/data/org-chart";

function TreeItem({ node }: { node: ReturnType<typeof buildTree>[number] }) {
  return (
    <li>
      <div className="flex items-center gap-1.5 py-1">
        <span className="size-1.5 rounded-full bg-[var(--brand-1)]" />
        <span className="text-sm font-medium">{node.titulo || "(sem título)"}</span>
        {node.area && <span className="text-xs text-muted-foreground">· {node.area}</span>}
      </div>
      {node.children.length > 0 && (
        <ul className="ml-3.5 border-l border-border pl-3.5 space-y-0.5">
          {node.children.map((child) => (
            <TreeItem key={child.id} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function OrgTreePreview({ nodes }: { nodes: OrgNode[] }) {
  const tree = buildTree(nodes);

  if (nodes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Adicione cargos para ver a estrutura do organograma aqui.
      </p>
    );
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
        <Network className="size-3.5" /> Pré-visualização da hierarquia
      </p>
      <ul className="space-y-0.5">
        {tree.map((node) => (
          <TreeItem key={node.id} node={node} />
        ))}
      </ul>
    </div>
  );
}
