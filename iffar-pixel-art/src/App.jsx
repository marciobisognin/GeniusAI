import { useEffect, useMemo, useState } from 'react'
import './styles.css'

const stateLabel = { prepared: 'Preparada', awaiting_human_approval: 'Aguardando aprovação', dispatched: 'Despachada', running: 'Executando', verification_pending: 'Validação pendente', completed_verified: 'Concluída e verificada', failed: 'Falhou', cancelled: 'Cancelada' }

function formatTime(value) {
  return value ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value)) : '---'
}

function PixelBuilding({ root, active, selected, onSelect }) {
  const shortName = root.name.replace(/^Campus\s+/i, '')
  return <button className={`building ${active ? 'is-active' : ''} ${selected ? 'is-selected' : ''}`} onClick={() => onSelect(root.code)} aria-pressed={selected}>
    <span className="roof" aria-hidden="true" />
    <span className="building-face" aria-hidden="true"><i /><i /><i /></span>
    <span className="building-label">{shortName}</span>
  </button>
}

function EventTimeline({ events }) {
  if (!events.length) return <p className="empty">Os eventos observáveis da execução aparecerão aqui. Planejamento não movimenta avatares.</p>
  return <ol className="timeline" aria-live="polite">{events.map((event) => <li key={event.id} className={event.type.startsWith('agent.') ? 'agent-event' : ''}>
    <time>{formatTime(event.ts)}</time><div><strong>{event.type.replace('run.', '').replace('agent.', '').replaceAll('_', ' ')}</strong><p>{event.message}</p></div>
  </li>)}</ol>
}

function AgentCard({ agent, active }) {
  return <article className={`agent-card ${active ? 'is-observed-active' : ''}`}>
    <div className="pixel-avatar" aria-hidden="true"><i /><b /></div>
    <div><h4>{agent.displayName}</h4><p>{agent.unit.name}</p><small>{agent.roleType} · p. {agent.normativeSource.unitPage}</small>
      <div className="skill-tags">{agent.skills.slice(0, 3).map((skill) => <span key={skill.id} title={`${skill.provenance}: ${skill.basis}`}>{skill.label}</span>)}</div>
    </div>
  </article>
}

function AgentDirectory({ agents, currentAgentId }) {
  const units = useMemo(() => {
    const grouped = new Map()
    for (const agent of agents) {
      const key = agent.unit.nodeId
      const entry = grouped.get(key) ?? { name: agent.unit.name, code: agent.unit.code, agents: [] }
      entry.agents.push(agent); grouped.set(key, entry)
    }
    return [...grouped.values()]
  }, [agents])
  if (!agents.length) return <p className="empty">Não há agentes catalogados para este espaço.</p>
  return <div className="directory"><p className="directory-summary">{agents.length} agentes em {units.length} Uorgs. Cada perfil deriva de uma posição da Portaria; não identifica ocupantes.</p>
    {units.map((unit) => <details key={unit.code} className="unit-directory"><summary>{unit.name} <span>{unit.agents.length} agente(s)</span></summary><div className="agent-grid">{unit.agents.map((agent) => <AgentCard key={agent.id} agent={agent} active={currentAgentId === agent.id} />)}</div></details>)}
  </div>
}

function ArtifactChecklist({ profile, check }) {
  if (!profile) return null
  return <div className="artifact-checklist"><strong>Entregas exigidas: {profile.label}</strong>{profile.requiresCourseIdentification && <p>Curso ainda não identificado: o PPC não poderá ser considerado completo.</p>}
    <ul>{profile.requiredGroups.map((group) => { const result = check?.groups?.find((item) => item.id === group.id); return <li key={group.id} className={result?.present ? 'is-present' : ''}>{result?.present ? '✓' : '○'} {group.label} <small>{group.extensions.join(', ')}</small></li> })}</ul>
  </div>
}

export default function App() {
  const [snapshot, setSnapshot] = useState(null)
  const [health, setHealth] = useState(null)
  const [task, setTask] = useState('')
  const [course, setCourse] = useState('')
  const [route, setRoute] = useState(null)
  const [executorId, setExecutorId] = useState('codex')
  const [selectedRoot, setSelectedRoot] = useState('1.1')
  const [spaceAgents, setSpaceAgents] = useState([])
  const [activeRun, setActiveRun] = useState(null)
  const [events, setEvents] = useState([])
  const [feedback, setFeedback] = useState('')
  const [approver, setApprover] = useState('')
  const [approvalReason, setApprovalReason] = useState('')
  const [approvalToken, setApprovalToken] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    const [snapshotResponse, healthResponse] = await Promise.all([fetch('/api/snapshot'), fetch('/health')])
    if (snapshotResponse.ok) setSnapshot(await snapshotResponse.json())
    if (healthResponse.ok) setHealth(await healthResponse.json())
  }

  useEffect(() => { void refresh() }, [])
  useEffect(() => {
    let disposed = false
    fetch(`/api/agents?root=${encodeURIComponent(selectedRoot)}`).then((response) => response.ok ? response.json() : { agents: [] }).then((result) => { if (!disposed) setSpaceAgents(result.agents ?? []) }).catch(() => { if (!disposed) setSpaceAgents([]) })
    return () => { disposed = true }
  }, [selectedRoot])
  useEffect(() => {
    if (!activeRun?.id) return undefined
    const stream = new EventSource(`/api/runs/${activeRun.id}/events`)
    stream.addEventListener('run', (message) => {
      const event = JSON.parse(message.data)
      setEvents((current) => current.some((item) => item.id === event.id) ? current : [...current, event])
      setActiveRun((current) => current ? { ...current, state: event.state ?? current.state, updatedAt: event.ts, ...event } : current)
      void refresh()
    })
    return () => stream.close()
  }, [activeRun?.id])

  const availableExecutors = health?.executors ?? []
  const selectedExecutor = availableExecutors.find((item) => item.id === executorId)
  const relevantRoots = useMemo(() => new Set(route?.actors?.map((actor) => actor.rootCode) ?? []), [route])
  const building = snapshot?.roots?.find((root) => root.code === selectedRoot)
  const displayedActors = route?.actors?.filter((actor) => actor.rootCode === selectedRoot) ?? []
  const ppcCandidate = /\bppc\b|projeto pedagógico|projeto pedagogico|currículo|curriculo/i.test(task)

  async function analyzeRoute() {
    setFeedback('')
    if (task.trim().length < 8) return setFeedback('Descreva a demanda com pelo menos 8 caracteres.')
    setBusy(true)
    try {
      const response = await fetch('/api/route', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ task, course }) })
      const result = await response.json(); if (!response.ok) throw new Error(result.error)
      setRoute(result); setSelectedRoot(result.campus?.code ?? result.actors?.[0]?.rootCode ?? '1.1')
      setFeedback('Rota preparada com a fonte normativa. Nenhuma CLI foi executada ainda.')
    } catch (cause) { setFeedback(cause.message) } finally { setBusy(false) }
  }

  async function startRun() {
    setFeedback('')
    if (!route) return setFeedback('Analise a rota antes de criar a execução.')
    setBusy(true)
    try {
      const response = await fetch('/api/runs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ task, course, executorId }) })
      const result = await response.json(); if (!response.ok) throw new Error(result.error)
      setActiveRun(result); setEvents([]); setRoute(result.route)
      setFeedback(result.state === 'awaiting_human_approval' ? 'A rota exige aprovação humana autenticada antes do despacho.' : selectedExecutor?.ready ? 'Despacho solicitado. Avatares só serão destacados por eventos observados.' : 'Rota e auditoria preparadas; o despacho será bloqueado até a autenticação válida do executor.')
    } catch (cause) { setFeedback(cause.message) } finally { setBusy(false) }
  }

  async function approve() {
    if (!activeRun) return
    setBusy(true)
    try {
      const response = await fetch(`/api/runs/${activeRun.id}/approve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ approvalToken, approver, reason: approvalReason }) })
      const result = await response.json(); if (!response.ok) throw new Error(result.error)
      setActiveRun(result); setApprovalToken(''); setFeedback('Aprovação autenticada e auditada. O despacho será observado nos eventos.')
    } catch (cause) { setFeedback(cause.message) } finally { setBusy(false) }
  }

  return <main className="app-shell">
    <header className="topbar"><div><p className="eyebrow">Centro operacional institucional</p><h1>IFFar <span>Pixel Art</span></h1></div><div className="source-badge"><strong>{snapshot?.source?.title ?? 'Carregando fonte'}</strong><span>{snapshot?.catalog?.counts?.units ?? '—'} Uorgs · {snapshot?.catalog?.counts?.agents ?? '—'} agentes</span></div></header>
    <section className="task-console" aria-labelledby="task-title"><div className="console-title"><p className="eyebrow">Solicitação</p><h2 id="task-title">Qual demanda precisa atravessar a instituição?</h2></div><label htmlFor="task">Tarefa</label><textarea id="task" value={task} onChange={(event) => setTask(event.target.value)} placeholder="Ex.: revisar um edital, produzir relatório, analisar uma norma ou elaborar PPC." />{ppcCandidate && <><label htmlFor="course">Curso oficial <small>Obrigatório apenas para concluir um PPC; não é inferido do texto.</small></label><input id="course" value={course} onChange={(event) => setCourse(event.target.value)} placeholder="Ex.: Bacharelado em Sistemas de Informação" /></>}<div className="console-actions"><button className="secondary" onClick={analyzeRoute} disabled={busy}>Analisar rota</button><label className="executor-select">Executor<select value={executorId} onChange={(event) => setExecutorId(event.target.value)}>{availableExecutors.map((executor) => <option key={executor.id} value={executor.id}>{executor.label} — {executor.ready ? 'pronto' : executor.available ? 'autenticação pendente' : 'indisponível'}</option>)}</select></label><button className="primary" onClick={startRun} disabled={busy || !route}>Criar e executar</button></div>{activeRun?.state === 'awaiting_human_approval' && <fieldset className="approval-form"><legend>Aprovação humana autenticada</legend><label>Identificador do aprovador<input value={approver} onChange={(event) => setApprover(event.target.value)} autoComplete="username" /></label><label>Motivo da aprovação<input value={approvalReason} onChange={(event) => setApprovalReason(event.target.value)} /></label><label>Token local do servidor<input value={approvalToken} onChange={(event) => setApprovalToken(event.target.value)} type="password" autoComplete="one-time-code" /></label><button className="approval" onClick={approve} disabled={busy}>Aprovar despacho</button></fieldset>}{feedback && <p className="feedback" role="status">{feedback}</p>}</section>
    <section className="workspace"><section className="map-panel" aria-label="Mapa espacial do IFFar"><div className="panel-heading"><div><p className="eyebrow">Projeção espacial</p><h2>Reitoria e campi</h2></div><span>{snapshot?.roots?.length ?? 0} espaços</span></div><div className="map-grid">{snapshot?.roots?.map((root) => <PixelBuilding key={root.code} root={root} active={relevantRoots.has(root.code)} selected={root.code === selectedRoot} onSelect={setSelectedRoot} />)}</div><p className="map-note">A rota é uma declaração. O destaque de avatares só ocorre após o bridge receber evento observado do executor.</p></section>
      <aside className="status-panel" aria-label="Estado da execução"><p className="eyebrow">Run atual</p><h2>{activeRun?.executionBlocker ? 'Despacho bloqueado' : activeRun ? stateLabel[activeRun.state] ?? activeRun.state : 'Sem execução'}</h2><dl><div><dt>Executor</dt><dd>{activeRun?.executorId ?? selectedExecutor?.label ?? 'Não selecionado'}</dd></div><div><dt>Integridade</dt><dd>{activeRun?.integrity ?? 'Não verificada'}</dd></div><div><dt>Entrega</dt><dd>{activeRun?.delivery ?? 'Não declarada'}</dd></div></dl>{activeRun?.executionBlocker && <p className="execution-blocker">{activeRun.executionBlocker}</p>}<ArtifactChecklist profile={activeRun?.artifactProfile ?? route?.artifactProfile} check={activeRun?.artifactCheck} />{activeRun?.artifacts?.length > 0 && <div className="artifact-list"><strong>Artefatos verificados</strong>{activeRun.artifacts.map((artifact) => <a key={artifact.id} href={`/api/runs/${activeRun.id}/artifacts/${artifact.id}`} target="_blank" rel="noreferrer">{artifact.relativePath} — {artifact.bytes} bytes</a>)}</div>}<EventTimeline events={events} /></aside></section>
    <section className="office-panel" aria-labelledby="office-title"><div className="panel-heading"><div><p className="eyebrow">Estrutura em foco</p><h2 id="office-title">{building?.name ?? 'Selecione um espaço'}</h2></div>{route && <span className="route-tag">{route.theme}</span>}</div>{displayedActors.length > 0 && <div className="route-actors"><strong>Unidades na rota desta demanda</strong>{displayedActors.map((actor) => <article className="route-actor" key={actor.nodeId}><h3>{actor.name}</h3><p>Uorg {actor.code} · Fonte: p. {actor.evidence.page ?? 'n/d'}</p><div className="agent-grid">{actor.agents.map((agent) => <AgentCard key={agent.id} agent={{ ...agent, unit: { name: actor.name } }} active={activeRun?.currentAgentId === agent.id} />)}</div></article>)}</div>}<AgentDirectory agents={spaceAgents} currentAgentId={activeRun?.currentAgentId} />{route && <footer className="evidence"><strong>Base normativa:</strong> {route.baseLegal.join('; ') || 'Triagem institucional.'} {route.requiresHumanApproval && <span>Esta demanda exige checkpoint humano.</span>}</footer>}</section>
  </main>
}
