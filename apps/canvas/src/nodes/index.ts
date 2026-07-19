import { AgentNode } from "./AgentNode.js";
import { ExecutionNode } from "./ExecutionNode.js";
import { NoteNode } from "./NoteNode.js";
import { SquadNode } from "./SquadNode.js";

export const nodeTypes = {
  agent: AgentNode,
  squad: SquadNode,
  note: NoteNode,
  execution: ExecutionNode,
};

export * from "./types.js";
