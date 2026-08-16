export interface OrgNode {
  id: string;
  titulo: string;
  area: string;
  responsabilidades: string[];
  parentId: string | null;
}

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function createEmptyNode(overrides: Partial<OrgNode> = {}): OrgNode {
  return {
    id: `node-${Math.random().toString(36).slice(2, 9)}`,
    titulo: "",
    area: "",
    responsabilidades: [],
    parentId: null,
    ...overrides,
  };
}

export function buildTree(nodes: OrgNode[]) {
  const byParent = new Map<string | null, OrgNode[]>();
  for (const node of nodes) {
    const list = byParent.get(node.parentId) ?? [];
    list.push(node);
    byParent.set(node.parentId, list);
  }
  const roots = byParent.get(null) ?? [];

  function attach(node: OrgNode): OrgNode & { children: ReturnType<typeof attach>[] } {
    return { ...node, children: (byParent.get(node.id) ?? []).map(attach) };
  }

  return roots.map(attach);
}
