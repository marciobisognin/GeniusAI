#!/usr/bin/env python3
"""Validate the GeniusAI Foresight package without external dependencies."""
from __future__ import annotations

import argparse
import ast
from collections import defaultdict, deque
import json
from pathlib import Path

REQUIRED = ["README.md","PRD.md","squad.yaml","pyproject.toml","LICENSE","NOTICE.md","AUTHORS.md","foresight/__init__.py","foresight/cli.py","foresight/game_theory.py","foresight/evidence.py","foresight/simulation.py","examples/soy-trade-shock.json"]


def load_json_yaml(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def validate(root: Path) -> dict[str, object]:
    errors=[]
    for rel in REQUIRED:
        if not (root/rel).is_file(): errors.append(f"missing:{rel}")
    if errors: return {"go_no_go":"no_go","errors":errors}
    manifest=load_json_yaml(root/"squad.yaml")
    expected_footer="Licença: MIT. Criado por Marcio Bisognin. Instagram: @marciobisognin."
    if manifest.get("response_footer")!=expected_footer: errors.append("manifest:response_footer")
    agents={}
    for aid in manifest.get("agents",[]):
        path=root/"agents"/f"{aid}.yaml"
        if not path.is_file(): errors.append(f"agent_missing:{aid}"); continue
        data=load_json_yaml(path); agents[aid]=data
        if data.get("id")!=aid: errors.append(f"agent_id_mismatch:{aid}")
        commands={item.get("name") for item in data.get("commands",[])}
        if not {"*help","*exit"}.issubset(commands): errors.append(f"agent_commands:{aid}")
    tasks={}
    for tid in manifest.get("tasks",[]):
        path=root/"tasks"/f"{tid}.yaml"
        if not path.is_file(): errors.append(f"task_missing:{tid}"); continue
        data=load_json_yaml(path); tasks[tid]=data
        if data.get("id")!=tid: errors.append(f"task_id_mismatch:{tid}")
        if data.get("assigned_agent") not in agents: errors.append(f"task_agent_unknown:{tid}")
    workflow_path=root/"workflows/foresight-cycle.yaml"
    workflow=load_json_yaml(workflow_path) if workflow_path.is_file() else {}
    workflow_tasks={step.get("task") for step in workflow.get("steps",[])}
    if workflow_tasks!=set(tasks): errors.append("workflow_task_coverage")
    indegree={tid:0 for tid in tasks}; edges=defaultdict(list)
    for tid,data in tasks.items():
        for dep in data.get("dependencies",[]):
            if dep not in tasks: errors.append(f"task_dependency_unknown:{tid}:{dep}")
            else: edges[dep].append(tid); indegree[tid]+=1
    queue=deque(t for t,d in indegree.items() if d==0); visited=0
    while queue:
        node=queue.popleft(); visited+=1
        for nxt in edges[node]:
            indegree[nxt]-=1
            if indegree[nxt]==0: queue.append(nxt)
    if visited!=len(tasks): errors.append("task_graph_cycle")
    python_files=list((root/"foresight").glob("*.py"))+list((root/"scripts").glob("*.py"))+list((root/"tests").glob("*.py"))
    for path in python_files:
        try: ast.parse(path.read_text(encoding="utf-8"),filename=str(path))
        except SyntaxError as exc: errors.append(f"syntax:{path.relative_to(root)}:{exc.lineno}")
    example=json.loads((root/"examples/soy-trade-shock.json").read_text(encoding="utf-8"))
    example_actor_ids={item["actor_id"] for item in example["actors"]}
    if example_actor_ids!=set(example["brief"]["actor_ids"]): errors.append("example_actor_coverage")
    return {"go_no_go":"go" if not errors else "no_go","errors":errors,"counts":{"agents":len(agents),"tasks":len(tasks),"workflow_steps":len(workflow.get("steps",[])),"python_files":len(python_files)},"checks":["required_files","manifest_references","agent_contracts","task_dag","workflow_coverage","python_syntax","example_integrity","attribution"]}


def main(argv=None):
    parser=argparse.ArgumentParser(); parser.add_argument("--root",type=Path,default=Path.cwd()); parser.add_argument("--json",action="store_true")
    args=parser.parse_args(argv); result=validate(args.root.resolve())
    print(json.dumps(result,ensure_ascii=False,indent=2))
    return 0 if result["go_no_go"]=="go" else 1

if __name__=="__main__": raise SystemExit(main())
