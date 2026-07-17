"""Auditable Markdown and self-contained HTML reports with safe rendering."""
from __future__ import annotations

from html import escape
import json
import os
from pathlib import Path
import tempfile

from .models import ActorCell, EvidenceRecord, SimulationBrief, SimulationResult
from .safety import safe_markdown_text

FOOTER = "Licença: MIT. Criado por Marcio Bisognin. Instagram: @marciobisognin."


def markdown_report(brief: SimulationBrief, result: SimulationResult, cells: list[ActorCell], evidence: list[EvidenceRecord]) -> str:
    safe_name = safe_markdown_text(brief.name)
    lines = [
        f"# {safe_name}",
        "",
        "> Simulação prospectiva condicional e experimental. Não é previsão garantida nem recomendação financeira, militar, jurídica ou de política pública.",
        "",
        f"**Data de corte:** {safe_markdown_text(brief.cutoff)}",
        f"**Horizonte:** {brief.horizon_steps} {safe_markdown_text(brief.step_unit)}(s)",
        f"**Execuções:** {result.runs} · **Seed:** {result.seed}",
        f"**Método:** `{safe_markdown_text(result.method['engine'])}` + `{safe_markdown_text(result.method['policy'])}`",
        "",
        "## Pergunta estratégica",
        "",
        safe_markdown_text(brief.problem),
        "",
        "## Atores e células institucionais",
        "",
    ]
    for cell in sorted(cells, key=lambda item: item.actor.actor_id):
        lines.append(f"### {safe_markdown_text(cell.actor.name)}")
        lines.append(f"- Governança: {safe_markdown_text(cell.actor.governance)}")
        lines.append(f"- Instituições: {', '.join(safe_markdown_text(item) for item in cell.actor.institutions)}")
        lines.append(f"- Agentes: {safe_markdown_text(cell.coordinator.role)}, " + ", ".join(safe_markdown_text(agent.role) for agent in cell.specialists))
        frequencies = result.actor_action_frequencies.get(cell.actor.actor_id, {})
        lines.append("- Política simulada: " + ", ".join(f"{safe_markdown_text(action)}={probability:.1%}" for action, probability in frequencies.items()))
        lines.append("")
    lines += [
        "## Distribuições finais",
        "",
        "| Variável | P10 ± MCSE | P50 ± MCSE | P90 ± MCSE | Média | Desvio |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for name, stats in result.quantiles.items():
        lines.append(f"| {safe_markdown_text(name)} | {stats['p10']:.4f} ± {stats['p10_mcse']:.4f} | {stats['p50']:.4f} ± {stats['p50_mcse']:.4f} | {stats['p90']:.4f} ± {stats['p90_mcse']:.4f} | {stats['mean']:.4f} | {stats['std']:.4f} |")
    lines += [
        "",
        "## Famílias de cenários definidas ex ante",
        "",
        "| Cenário | Frequência | MCSE | IC 95% | Gatilho operacional |",
        "|---|---:|---:|---:|---|",
    ]
    for scenario in result.scenarios:
        lines.append(f"| {safe_markdown_text(scenario.name)} | {scenario.probability:.1%} | {scenario.mcse:.2%} | {scenario.ci95_low:.1%}–{scenario.ci95_high:.1%} | {safe_markdown_text(scenario.trigger)} |")
    lines += ["", "## Eventos derivados com incerteza Monte Carlo", ""]
    for name, uncertainty in result.event_uncertainty.items():
        lines.append(f"- **{safe_markdown_text(name)}:** {uncertainty['probability']:.1%} · MCSE {uncertainty['mcse']:.2%} · IC95% {uncertainty['ci95_low']:.1%}–{uncertainty['ci95_high']:.1%}")
    lines += ["", "## Workflow executado", ""]
    for stage in result.workflow:
        lines.append(f"- `{safe_markdown_text(stage['task'])}` · {safe_markdown_text(stage['agent'])} · **{safe_markdown_text(stage['status'])}**")
    lines += ["", "## Evidências admissíveis e vintage ativa", ""]
    for item in evidence:
        claim = safe_markdown_text(item.claim)
        evidence_id = safe_markdown_text(item.evidence_id)
        revision = safe_markdown_text(item.revision_id)
        lines.append(f"- [{evidence_id}@{revision}] {claim} — <{item.source_url}> (release: {safe_markdown_text(item.release_time)})")
    lines += ["", "## Limitações e regras de abstenção", ""]
    lines.extend(f"- {safe_markdown_text(warning)}" for warning in result.warnings)
    lines += [
        "- As probabilidades deste MVP são model-implied, incluem MCSE, mas ainda não foram calibradas em backtest point-in-time.",
        "- O sistema deve abster-se quando faltarem dados, forecast contract, resolução ex ante ou domain pack validado.",
        "",
        f"**Evidence snapshot:** `{result.method['evidence_snapshot_sha256']}`",
        f"**Model signature:** `{result.method['model_signature_sha256']}`",
        "",
        FOOTER,
        "",
    ]
    return "\n".join(lines)


def html_report(markdown: str, result: SimulationResult) -> str:
    scenario_cards = "".join(f"<article><h3>{escape(scenario.name.title())}</h3><strong>{scenario.probability:.1%}</strong><p>MCSE {scenario.mcse:.2%}</p><p>{escape(scenario.trigger)}</p></article>" for scenario in result.scenarios)
    quantile_rows = "".join(f"<tr><td>{escape(name)}</td><td>{stats['p10']:.4f}</td><td>{stats['p50']:.4f}</td><td>{stats['p90']:.4f}</td></tr>" for name, stats in result.quantiles.items())
    return f'''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{escape(result.study_name)}</title><style>:root{{--bg:#0b1020;--panel:#151d33;--text:#eef3ff;--muted:#aab6d3;--accent:#66d9c8}}*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--text);font:16px system-ui;line-height:1.55}}main{{max-width:1080px;margin:auto;padding:32px}}header,section,article{{background:var(--panel);border:1px solid #263554;border-radius:16px;padding:20px}}header{{margin-bottom:20px}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px}}strong{{font-size:1.7rem;color:var(--accent)}}table{{width:100%;border-collapse:collapse}}th,td{{padding:10px;border-bottom:1px solid #2b3958;text-align:left}}pre{{white-space:pre-wrap;background:#090d18;padding:16px;border-radius:12px;color:var(--muted)}}footer{{color:var(--muted);margin-top:24px}}</style></head><body><main><header><p>GeniusAI Foresight</p><h1>{escape(result.study_name)}</h1><p>Simulação condicional · {result.runs} execuções · seed {result.seed}</p></header><section><h2>Cenários</h2><div class="grid">{scenario_cards}</div></section><section><h2>Quantis finais</h2><table><thead><tr><th>Variável</th><th>P10</th><th>P50</th><th>P90</th></tr></thead><tbody>{quantile_rows}</tbody></table></section><section><h2>Relatório auditável</h2><pre>{escape(markdown)}</pre></section><footer>{escape(FOOTER)}</footer></main></body></html>'''


def _atomic_write(path: Path, content: str, *, force: bool) -> None:
    if path.is_symlink() or path.parent.is_symlink():
        raise ValueError("recusa de escrita em symlink")
    if path.exists() and not force:
        raise FileExistsError(f"arquivo já existe: {path}; use --force")
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        temporary.replace(path)
    finally:
        if temporary.exists():
            temporary.unlink()


def write_reports(output_dir: Path, brief: SimulationBrief, result: SimulationResult, cells: list[ActorCell], evidence: list[EvidenceRecord], *, force: bool = False) -> dict[str, str]:
    if output_dir.is_symlink():
        raise ValueError("output_dir não pode ser symlink")
    output_dir.mkdir(parents=True, exist_ok=True)
    markdown = markdown_report(brief, result, cells, evidence)
    html = html_report(markdown, result)
    paths = {"json": output_dir / "result.json", "markdown": output_dir / "report.md", "html": output_dir / "report.html"}
    _atomic_write(paths["json"], json.dumps(result.to_dict(), ensure_ascii=False, indent=2) + "\n", force=force)
    _atomic_write(paths["markdown"], markdown, force=force)
    _atomic_write(paths["html"], html, force=force)
    return {key: str(path) for key, path in paths.items()}
