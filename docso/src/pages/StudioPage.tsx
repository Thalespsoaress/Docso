import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import Sidebar from '../components/Sidebar'
import FlowView, { type Step as FlowStep, type Gateway as FlowGateway } from '../components/FlowView'

type Lane      = { id: string; title: string }
type StudioStep = { id: string; title: string; description: string; laneId: string }

type StudioBranchStep = { id: string; title: string; description: string; laneId: string }
type StudioBranch     = { id: string; label: string; color: string; steps: StudioBranchStep[] }
type GatewayType      = 'exclusive' | 'parallel' | 'inclusive'
type StudioGateway    = {
  id: string
  afterStepId: string
  type: GatewayType
  question: string
  branches: StudioBranch[]
}

type Analise = {
  gargalos: string[]
  riscos: string[]
  melhorias: string[]
}

type QuizQuestion = {
  id: string
  question: string
  options: [string, string, string, string]
  correct: 0 | 1 | 2 | 3
}

type ExistingProcess = {
  id: string
  title: string
  objective: string | null
  executor: string | null
  frequency: string | null
  metadata?: { analise?: Analise } | null
  quiz?: QuizQuestion[] | null
  steps: { order: number; title: string; description?: string; sectionTitle?: string; sectionIndex?: number }[]
  gateways?: {
    id: string
    afterStep: number
    type?: string
    question: string
    branches: {
      id: string; label: string; color: string
      steps: { order: number; title: string; description?: string; sectionTitle?: string; sectionIndex?: number }[]
    }[]
  }[]
}

type SaveStatus = 'idle' | 'saving' | 'saved'

// Só cores da marca: funcionais + neutros
const GW_PALETTE = ['#30BCFE', '#39BD3D', '#FADB02', '#FE7451', '#0A0A0A', '#A0A0A0']

const LANE_COLORS = ['#30BCFE', '#39BD3D', '#FADB02', '#FE7451', '#0A0A0A', '#A0A0A0']

const GW_TYPE_LABELS: Record<GatewayType, string> = {
  exclusive: 'Exclusivo',
  parallel:  'Paralelo',
  inclusive: 'Inclusivo',
}

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function flattenSteps(steps: StudioStep[], lanes: Lane[]) {
  return steps.map((step, idx) => {
    const laneIdx = lanes.findIndex(l => l.id === step.laneId)
    const lane    = lanes[laneIdx]
    return {
      order: idx + 1,
      title: step.title,
      description: step.description,
      ...(lane ? { sectionTitle: lane.title, sectionIndex: laneIdx } : {}),
    }
  })
}

function flattenGateways(gateways: StudioGateway[], steps: StudioStep[], lanes: Lane[]) {
  const orderMap = new Map<string, number>()
  steps.forEach((st, i) => orderMap.set(st.id, i + 1))
  return gateways
    .filter(gw => orderMap.has(gw.afterStepId))
    .map(gw => ({
      id: gw.id,
      afterStep: orderMap.get(gw.afterStepId)!,
      type: gw.type,
      question: gw.question,
      branches: gw.branches.map(b => ({
        id: b.id, label: b.label, color: b.color,
        steps: b.steps.map((s, si) => {
          const laneIdx = lanes.findIndex(l => l.id === s.laneId)
          const lane    = lanes[laneIdx]
          return { order: si + 1, title: s.title, description: s.description, ...(lane ? { sectionTitle: lane.title, sectionIndex: laneIdx } : {}) }
        }),
      })),
    }))
}

function loadGateways(raw: ExistingProcess['gateways'], steps: StudioStep[], lanes: Lane[]): StudioGateway[] {
  if (!raw?.length) return []
  const idMap = new Map<number, string>()
  steps.forEach((st, i) => idMap.set(i + 1, st.id))
  return raw.map(gw => ({
    id: gw.id,
    afterStepId: idMap.get(gw.afterStep) ?? '',
    type: (gw.type as GatewayType) ?? 'exclusive',
    question: gw.question,
    branches: gw.branches.map(b => ({
      id: b.id, label: b.label, color: b.color,
      steps: b.steps.map(s => {
        const lane = s.sectionIndex !== undefined ? lanes.find((_, i) => i === s.sectionIndex) : undefined
        return { id: generateId(), title: s.title, description: s.description ?? '', laneId: lane?.id ?? '' }
      }),
    })),
  }))
}

function defaultBranches(): StudioBranch[] {
  return [
    { id: generateId(), label: 'Sim', color: '#39BD3D', steps: [] },
    { id: generateId(), label: 'Não', color: '#FE7451', steps: [] },
  ]
}

function AutoResizeTextarea({
  id, value, onChange, placeholder, className,
}: {
  id?: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [value])
  return (
    <textarea ref={ref} id={id} className={className} value={value}
      onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={1} />
  )
}

function GatewayIcon({ type, size = 14 }: { type: GatewayType; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      {type === 'exclusive' && (<><line x1="4" y1="4" x2="10" y2="10"/><line x1="10" y1="4" x2="4" y2="10"/></>)}
      {type === 'parallel'  && (<><line x1="7" y1="3" x2="7" y2="11"/><line x1="3" y1="7" x2="11" y2="7"/></>)}
      {type === 'inclusive' && (<circle cx="7" cy="7" r="3.5"/>)}
    </svg>
  )
}

export default function StudioPage() {
  const navigate = useNavigate()
  const { id: editId } = useParams({ strict: false }) as { id?: string }
  const initializedRef = useRef(false)

  const [title, setTitle]         = useState('')
  const [objective, setObjective] = useState('')
  const [frequency, setFrequency] = useState('')
  const [lanes, setLanes]         = useState<Lane[]>([])
  const [steps, setSteps]         = useState<StudioStep[]>([
    { id: generateId(), title: '', description: '', laneId: '' },
  ])
  const [gateways, setGateways] = useState<StudioGateway[]>([])
  const [gwColorPicker, setGwColorPicker] = useState<{ gwId: string; branchId: string } | null>(null)

  const [analise, setAnalise] = useState<Analise | null>(null)
  const [analiseOpen, setAnaliseOpen] = useState(true)
  const [quiz, setQuiz] = useState<QuizQuestion[]>([])
  const [quizGenerating, setQuizGenerating] = useState(false)

  const [tab, setTab] = useState<'edit' | 'flow'>('edit')

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [savedAt, setSavedAt]       = useState<Date | null>(null)
  const [processId, setProcessId]   = useState<string | null>(editId ?? null)

  const { data: existingProcess } = useQuery({
    queryKey: ['process', editId],
    queryFn: () => api.get<ExistingProcess>(`/api/processes/${editId}`),
    enabled: !!editId,
  })

  useEffect(() => {
    if (!existingProcess || initializedRef.current) return
    initializedRef.current = true
    setTitle(existingProcess.title)
    setObjective(existingProcess.objective ?? '')
    setFrequency(existingProcess.frequency ?? '')

    const rawSteps = existingProcess.steps
    if (rawSteps.length === 0) return

    // Reconstruct lanes from sectionIndex/sectionTitle on saved steps
    const laneMap = new Map<number, Lane>()
    rawSteps.forEach(s => {
      const idx = s.sectionIndex
      if (idx !== undefined && !laneMap.has(idx)) {
        laneMap.set(idx, { id: generateId(), title: s.sectionTitle ?? '' })
      }
    })
    const sortedLanes = Array.from(laneMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, l]) => l)
    setLanes(sortedLanes)

    // Reconstruct flat steps preserving order
    const loadedSteps: StudioStep[] = rawSteps.map(s => {
      const laneIdx = s.sectionIndex
      const lane    = laneIdx !== undefined ? (laneMap.get(laneIdx) ?? null) : null
      return { id: generateId(), title: s.title, description: s.description ?? '', laneId: lane?.id ?? '' }
    })
    setSteps(loadedSteps)
    setGateways(loadGateways(existingProcess.gateways, loadedSteps, sortedLanes))
    if (existingProcess.metadata?.analise) setAnalise(existingProcess.metadata.analise)
    if (Array.isArray(existingProcess.quiz)) setQuiz(existingProcess.quiz as QuizQuestion[])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingProcess])

  const [deleteConfirm, setDeleteConfirm] = useState<{ stepId: string } | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSavingRef  = useRef(false)

  // Sem status o PATCH mantém o atual: autosave não despublica processo publicado
  const buildPayload = useCallback((status?: string) => ({
    title:     title.trim() || 'Sem título',
    objective: objective.trim() || null,
    executor:  lanes.map(l => l.title).filter(Boolean).join(', ') || null,
    frequency: frequency.trim() || null,
    steps:     flattenSteps(steps, lanes),
    gateways:  flattenGateways(gateways, steps, lanes),
    ...(status ? { status } : {}),
    ...(analise ? { metadata: { analise } } : {}),
    quiz: quiz.length > 0 ? quiz : [],
  }), [title, objective, frequency, steps, lanes, gateways, analise, quiz])

  const doSave = useCallback(async (status?: string) => {
    if (isSavingRef.current) return
    if (!processId && !title.trim()) return
    isSavingRef.current = true
    setSaveStatus('saving')
    try {
      const payload = buildPayload(status)
      if (processId) {
        await api.patch(`/api/processes/${processId}`, payload)
      } else {
        const created = await api.post<{ id: string }>('/api/processes', payload)
        setProcessId(created.id)
      }
      setSavedAt(new Date())
      setSaveStatus('saved')
    } catch {
      setSaveStatus('idle')
    } finally {
      isSavingRef.current = false
    }
  }, [buildPayload, processId, title])

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => doSave(), 1000)
  }, [doSave])

  useEffect(() => {
    scheduleSave()
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, objective, frequency, steps, lanes, gateways])

  const pendingActionRef = useRef<(() => void) | null>(null)
  const [showExitModal, setShowExitModal]         = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  function tryLeave(action: () => void) { pendingActionRef.current = action; setShowExitModal(true) }
  function confirmLeave() { setShowExitModal(false); pendingActionRef.current?.(); pendingActionRef.current = null }
  function cancelLeave()  { setShowExitModal(false); pendingActionRef.current = null }

  async function handlePublish() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    await doSave('published')
    navigate({ to: '/biblioteca' })
  }
  function handleDiscard() { tryLeave(() => navigate({ to: '/biblioteca' })) }
  async function handleDelete() {
    if (!editId) return
    await api.delete(`/api/processes/${editId}`)
    navigate({ to: '/biblioteca' })
  }

  // ── Lane helpers ──
  function addLane() {
    const newLane: Lane = { id: generateId(), title: '' }
    setLanes(prev => {
      const next = [...prev, newLane]
      // Assign uncategorized steps to first lane when adding the first lane
      if (prev.length === 0) {
        setSteps(s => s.map(st => st.laneId === '' ? { ...st, laneId: newLane.id } : st))
      }
      return next
    })
  }
  function updateLaneTitle(laneId: string, value: string) {
    setLanes(prev => prev.map(l => l.id === laneId ? { ...l, title: value } : l))
  }
  function removeLane(laneId: string) {
    setLanes(prev => {
      const remaining = prev.filter(l => l.id !== laneId)
      const fallback  = remaining[0]?.id ?? ''
      setSteps(s => s.map(st => st.laneId === laneId ? { ...st, laneId: fallback } : st))
      return remaining
    })
  }

  // ── Step helpers ──
  function addStep() {
    const laneId = lanes.length > 0 ? (steps.at(-1)?.laneId ?? lanes[0].id) : ''
    setSteps(prev => [...prev, { id: generateId(), title: '', description: '', laneId }])
  }
  function updateStep(stepId: string, field: 'title' | 'description', value: string) {
    setSteps(prev => prev.map(st => st.id === stepId ? { ...st, [field]: value } : st))
  }
  function setStepLane(stepId: string, laneId: string) {
    setSteps(prev => prev.map(st => st.id === stepId ? { ...st, laneId } : st))
  }
  function removeStep(stepId: string) {
    setSteps(prev => prev.filter(st => st.id !== stepId))
    setGateways(prev => prev.filter(gw => gw.afterStepId !== stepId))
    setDeleteConfirm(null)
  }

  // ── Drag-and-drop (flat list) ──
  const dragSrcRef = useRef<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  function onStepDragStart(e: React.DragEvent, stepId: string) {
    dragSrcRef.current = stepId; setDraggingId(stepId); e.dataTransfer.effectAllowed = 'move'
  }
  function onStepDragOver(e: React.DragEvent, stepId: string) {
    if (!dragSrcRef.current) return
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'
    if (dragSrcRef.current !== stepId) setDragOverId(stepId)
  }
  function onStepDrop(e: React.DragEvent, stepId: string) {
    e.preventDefault()
    const src = dragSrcRef.current
    if (src && src !== stepId) {
      setSteps(prev => {
        const arr    = [...prev]
        const srcIdx = arr.findIndex(st => st.id === src)
        const tgtIdx = arr.findIndex(st => st.id === stepId)
        if (srcIdx === -1 || tgtIdx === -1) return prev
        const [removed] = arr.splice(srcIdx, 1)
        arr.splice(tgtIdx, 0, removed)
        return arr
      })
    }
    dragSrcRef.current = null; setDraggingId(null); setDragOverId(null)
  }
  function onStepDragEnd() { dragSrcRef.current = null; setDraggingId(null); setDragOverId(null) }

  // ── Gateway helpers ──
  function addGateway(afterStepId: string) {
    if (gateways.some(gw => gw.afterStepId === afterStepId)) return
    setGateways(prev => [...prev, {
      id: generateId(), afterStepId, type: 'exclusive', question: '', branches: defaultBranches(),
    }])
  }
  function removeGateway(gwId: string) {
    setGateways(prev => prev.filter(gw => gw.id !== gwId))
  }
  function updateGateway(gwId: string, field: 'type' | 'question', value: string) {
    setGateways(prev => prev.map(gw => gw.id === gwId ? { ...gw, [field]: value } : gw))
  }
  function addBranch(gwId: string) {
    const colors = ['#30BCFE', '#FADB02', '#0A0A0A', '#A0A0A0']
    setGateways(prev => prev.map(gw => {
      if (gw.id !== gwId) return gw
      const color = colors[gw.branches.length % colors.length]
      return { ...gw, branches: [...gw.branches, { id: generateId(), label: `Caminho ${gw.branches.length + 1}`, color, steps: [] }] }
    }))
  }
  function removeBranch(gwId: string, branchId: string) {
    setGateways(prev => prev.map(gw =>
      gw.id === gwId ? { ...gw, branches: gw.branches.filter(b => b.id !== branchId) } : gw
    ))
  }
  function updateBranch(gwId: string, branchId: string, field: 'label' | 'color', value: string) {
    setGateways(prev => prev.map(gw =>
      gw.id === gwId
        ? { ...gw, branches: gw.branches.map(b => b.id === branchId ? { ...b, [field]: value } : b) }
        : gw
    ))
  }
  function addBranchStep(gwId: string, branchId: string) {
    const laneId = lanes[0]?.id ?? ''
    setGateways(prev => prev.map(gw =>
      gw.id === gwId
        ? { ...gw, branches: gw.branches.map(b => b.id === branchId ? { ...b, steps: [...b.steps, { id: generateId(), title: '', description: '', laneId }] } : b) }
        : gw
    ))
  }
  function removeBranchStep(gwId: string, branchId: string, stepId: string) {
    setGateways(prev => prev.map(gw =>
      gw.id === gwId
        ? { ...gw, branches: gw.branches.map(b => b.id === branchId ? { ...b, steps: b.steps.filter(s => s.id !== stepId) } : b) }
        : gw
    ))
  }
  function updateBranchStep(gwId: string, branchId: string, stepId: string, field: 'title' | 'description' | 'laneId', value: string) {
    setGateways(prev => prev.map(gw =>
      gw.id === gwId
        ? { ...gw, branches: gw.branches.map(b => b.id === branchId ? { ...b, steps: b.steps.map(s => s.id === stepId ? { ...s, [field]: value } : s) } : b) }
        : gw
    ))
  }

  const breadcrumbTitle = title.trim() || 'Novo processo'

  const flowSteps: FlowStep[] = flattenSteps(steps, lanes)
  const flowGateways: FlowGateway[] = flattenGateways(gateways, steps, lanes)

  return (
    <div className="app-shell" onClick={() => setGwColorPicker(null)}>
      <Sidebar onNavigate={tryLeave} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F2F2F2' }}>

        {/* TOPBAR */}
        <div className="process-topbar">
          <div className="breadcrumb">
            <span style={{ cursor: 'pointer', color: 'var(--cinza-texto)' }} onClick={() => tryLeave(() => navigate({ to: '/biblioteca' }))}>Studio</span>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">{breadcrumbTitle}</span>
          </div>
          <div className="autosave-label">
            {saveStatus === 'saving' && (<><span className="autosave-dot saving" />Salvando...</>)}
            {saveStatus === 'saved' && savedAt && (<><span className="autosave-dot saved" />Salvo às {formatTime(savedAt)}</>)}
          </div>
          <div className="topbar-actions">
            {editId && !deleteConfirmOpen && (
              <button className="btn-ghost btn-ghost-danger" onClick={() => setDeleteConfirmOpen(true)}>
                <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="2,3.5 11,3.5"/><path d="M4.5,3.5V2.5h4v1"/><path d="M3,3.5l.7,7h5.6l.7-7"/>
                </svg>
                Apagar
              </button>
            )}
            {deleteConfirmOpen && (
              <>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: 'var(--vermelho-texto)' }}>Confirmar exclusão?</span>
                <button className="btn-ghost" onClick={() => setDeleteConfirmOpen(false)}>Cancelar</button>
                <button className="btn-danger" onClick={handleDelete}>Apagar</button>
              </>
            )}
            {!deleteConfirmOpen && (
              <>
                <button className="btn-ghost" onClick={() => {
                  sessionStorage.setItem('mapeamento-processo', JSON.stringify({
                    processId: processId ?? editId ?? null,
                    title: title.trim() || 'Sem título',
                    objective: objective.trim() || null,
                    executor: lanes.map(l => l.title).filter(Boolean).join(', ') || null,
                    frequency: frequency.trim() || null,
                    steps: flattenSteps(steps, lanes),
                  }))
                  navigate({ to: '/mapeamento' })
                }}>
                  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width={13} height={13}>
                    <path d="M7 1l1.5 3.5L12 6 8.5 7.5 7 11 5.5 7.5 2 6l3.5-1.5z"/>
                  </svg>
                  Refinar com IA
                </button>
                <button className="btn-ghost" onClick={handleDiscard}>Descartar</button>
                <button className="btn-solid" onClick={handlePublish}>Publicar</button>
              </>
            )}
          </div>
        </div>

        {/* TABS */}
        <div className="tabs-bar">
          <button className={`tab-btn${tab === 'edit' ? ' active' : ''}`} onClick={() => setTab('edit')}>
            <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9.5V11h1.5l5-5-1.5-1.5-5 5zM10.5 3.5l-1-1a.7.7 0 0 0-1 0l-.9.9 1.5 1.5.9-.9a.7.7 0 0 0 0-1z"/></svg>
            Editar
          </button>
          <button className={`tab-btn${tab === 'flow' ? ' active' : ''}`} onClick={() => setTab('flow')}>
            <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="1" width="4" height="3" rx="1"/><rect x="8" y="5" width="4" height="3" rx="1"/><rect x="1" y="9" width="4" height="3" rx="1"/><path d="M5 2.5h2a1 1 0 0 1 1 1v1"/><path d="M5 10.5h2a1 1 0 0 0 1-1v-1"/></svg>
            Fluxograma
          </button>
        </div>

        {/* VIEW FLUXOGRAMA */}
        {tab === 'flow' && flowSteps.length > 0 && (
          <FlowView steps={flowSteps} gateways={flowGateways} processId={processId ?? 'draft'} />
        )}
        {tab === 'flow' && flowSteps.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cinza-texto)', fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>
            Adicione etapas para visualizar o fluxograma.
          </div>
        )}

        {/* EDITOR */}
        {tab === 'edit' && <div className="editor-scroll">
          <div className="editor-inner">

            {/* INFO CARD */}
            <div className="card">
              <div className="card-header">
                <div className="card-section-title">Informações gerais</div>
              </div>
              <div className="field">
                <label htmlFor="field-title" className="field-label">Nome do processo <span style={{ color: 'var(--vermelho)', marginLeft: 3 }}>*</span></label>
                <input id="field-title" className="field-input" placeholder="Ex: Onboarding de novos colaboradores" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="field-objective" className="field-label">Objetivo</label>
                <AutoResizeTextarea id="field-objective" className="field-textarea" placeholder="Descreva o objetivo deste processo..." value={objective} onChange={setObjective} />
              </div>
              <div className="field">
                <label htmlFor="field-frequency" className="field-label">Frequência</label>
                <select id="field-frequency" className="field-select" value={frequency} onChange={e => setFrequency(e.target.value)}>
                  <option value="">Selecionar...</option>
                  <option value="Diário">Diário</option>
                  <option value="Semanal">Semanal</option>
                  <option value="Quinzenal">Quinzenal</option>
                  <option value="Mensal">Mensal</option>
                  <option value="Trimestral">Trimestral</option>
                  <option value="Sob demanda">Sob demanda</option>
                </select>
              </div>
            </div>

            {/* RAIAS CARD */}
            <div className="card">
              <div className="card-header" style={{ borderBottom: lanes.length > 0 ? '1px solid var(--cinza-sup)' : 'none' }}>
                <div className="card-section-title">Raias</div>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: 'var(--cinza-texto)' }}>
                  Defina quem executa cada parte do processo
                </span>
              </div>
              {lanes.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {lanes.map((lane, i) => (
                    <div key={lane.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 24px', borderBottom: '1px solid var(--cinza-sup)' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: LANE_COLORS[i % LANE_COLORS.length], flexShrink: 0 }} />
                      <input
                        className="field-input"
                        style={{ flex: 1, fontSize: 13 }}
                        placeholder={`Raia ${i + 1} — ex: Financeiro, RH...`}
                        value={lane.title}
                        onChange={e => updateLaneTitle(lane.id, e.target.value)}
                      />
                      <button
                        onClick={() => removeLane(lane.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C0C0C0', fontSize: 18, lineHeight: 1, padding: '2px 4px', borderRadius: 4 }}
                        title="Remover raia"
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ padding: '12px 24px' }}>
                <button
                  onClick={addLane}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--cinza-texto)', padding: 0 }}
                >
                  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width={10} height={10}>
                    <line x1="7" y1="2" x2="7" y2="12"/><line x1="2" y1="7" x2="12" y2="7"/>
                  </svg>
                  Adicionar raia
                </button>
              </div>
            </div>

            {/* ETAPAS */}
            <div className="card">
              <div className="card-header" style={{ borderBottom: '1px solid var(--cinza-sup)' }}>
                <div className="card-section-title">Etapas</div>
              </div>
              <div className="steps-body">
                {steps.map((step, stIdx) => {
                  const stepGateway = gateways.find(gw => gw.afterStepId === step.id)
                  const hasGateway  = !!stepGateway
                  const laneName    = lanes.find(l => l.id === step.laneId)?.title ?? ''

                  return (
                    <div key={step.id}>
                      <div
                        className={`step-row${draggingId === step.id ? ' step-dragging' : ''}${dragOverId === step.id ? ' step-drag-over' : ''}`}
                        draggable
                        onDragStart={e => onStepDragStart(e, step.id)}
                        onDragOver={e => onStepDragOver(e, step.id)}
                        onDrop={e => onStepDrop(e, step.id)}
                        onDragEnd={onStepDragEnd}
                      >
                        <div className="step-drag-handle">
                          <svg viewBox="0 0 10 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                            <line x1="3" y1="4" x2="7" y2="4"/><line x1="3" y1="8" x2="7" y2="8"/><line x1="3" y1="12" x2="7" y2="12"/>
                          </svg>
                        </div>
                        <div className="step-num-badge">{String(stIdx + 1).padStart(2, '0')}</div>

                        {/* Lane selector — only visible when 2+ lanes exist */}
                        {lanes.length >= 2 && (
                          <select
                            value={step.laneId}
                            onChange={e => setStepLane(step.id, e.target.value)}
                            className="step-lane-select"
                            title="Raia desta etapa"
                          >
                            {lanes.map((l, i) => (
                              <option key={l.id} value={l.id}>{l.title || `Raia ${i + 1}`}</option>
                            ))}
                          </select>
                        )}
                        {/* Lane dot indicator — when exactly 1 lane */}
                        {lanes.length === 1 && (
                          <div
                            style={{ width: 8, height: 8, borderRadius: '50%', background: LANE_COLORS[0], flexShrink: 0, marginTop: 13 }}
                            title={laneName || 'Raia 1'}
                          />
                        )}

                        <div className="step-fields">
                          <input className="step-name-input" placeholder="Nome da etapa" value={step.title} onChange={e => updateStep(step.id, 'title', e.target.value)} />
                          <AutoResizeTextarea className="step-desc-input" placeholder="Descreva o que deve ser feito nesta etapa..." value={step.description} onChange={v => updateStep(step.id, 'description', v)} />
                        </div>

                        {!hasGateway && (
                          <button
                            className="step-delete-btn"
                            title="Adicionar gateway após esta etapa"
                            style={{ color: 'var(--cinza-texto)' }}
                            onClick={() => addGateway(step.id)}
                          >
                            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                              <rect x="3" y="3" width="8" height="8" rx="1" transform="rotate(45 7 7)"/>
                              <line x1="7" y1="5" x2="7" y2="9"/><line x1="5" y1="7" x2="9" y2="7"/>
                            </svg>
                          </button>
                        )}
                        <button className="step-delete-btn" title="Remover etapa" onClick={() => setDeleteConfirm({ stepId: step.id })}>
                          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <line x1="2" y1="2" x2="12" y2="12"/><line x1="12" y1="2" x2="2" y2="12"/>
                          </svg>
                        </button>
                      </div>

                      {deleteConfirm?.stepId === step.id && (
                        <div className="delete-confirm">
                          <span>Remover esta etapa?</span>
                          <button className="btn-confirm-del" onClick={() => removeStep(step.id)}>Remover</button>
                          <button className="btn-cancel-del" onClick={() => setDeleteConfirm(null)}>Cancelar</button>
                        </div>
                      )}

                      {/* ── Gateway block ── */}
                      {stepGateway && (
                        <div style={{ margin: '8px 0 8px 32px', background: '#fff', border: '1.5px solid var(--cinza-borda)', borderLeft: '3px solid #0A0A0A', borderRadius: 10, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {(['exclusive', 'parallel', 'inclusive'] as GatewayType[]).map(t => (
                                <button
                                  key={t}
                                  title={GW_TYPE_LABELS[t]}
                                  onClick={() => updateGateway(stepGateway.id, 'type', t)}
                                  style={{
                                    width: 28, height: 28, borderRadius: 6, border: '1.5px solid',
                                    borderColor: stepGateway.type === t ? '#0A0A0A' : 'var(--cinza-borda)',
                                    background: stepGateway.type === t ? '#0A0A0A' : '#fff',
                                    color: stepGateway.type === t ? '#fff' : 'var(--cinza-texto)',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}
                                >
                                  <GatewayIcon type={t} size={12} />
                                </button>
                              ))}
                            </div>
                            <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--cinza-texto)' }}>
                              {GW_TYPE_LABELS[stepGateway.type]}
                            </span>
                            <input
                              style={{ flex: 1, fontFamily: "'DM Sans', sans-serif", fontSize: 13, border: 'none', borderBottom: '1px solid var(--cinza-borda)', outline: 'none', background: 'transparent', color: 'var(--preto)', padding: '2px 0' }}
                              placeholder="Condição ou pergunta de decisão..."
                              value={stepGateway.question}
                              onChange={e => updateGateway(stepGateway.id, 'question', e.target.value)}
                            />
                            <button
                              onClick={() => removeGateway(stepGateway.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cinza-texto)', fontSize: 16, lineHeight: 1, padding: '2px 4px', borderRadius: 4 }}
                              title="Remover gateway"
                            >×</button>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {stepGateway.branches.map((branch, bi) => (
                              <div key={branch.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ position: 'relative' }}>
                                    <button
                                      onClick={e => { e.stopPropagation(); setGwColorPicker(gwColorPicker?.gwId === stepGateway.id && gwColorPicker.branchId === branch.id ? null : { gwId: stepGateway.id, branchId: branch.id }) }}
                                      style={{ width: 20, height: 20, borderRadius: '50%', background: branch.color, border: '2px solid rgba(0,0,0,0.1)', cursor: 'pointer', flexShrink: 0 }}
                                      title="Alterar cor"
                                    />
                                    {gwColorPicker?.gwId === stepGateway.id && gwColorPicker.branchId === branch.id && (
                                      <div
                                        onClick={e => e.stopPropagation()}
                                        style={{ position: 'absolute', top: 26, left: 0, zIndex: 20, background: '#fff', border: '1.5px solid var(--cinza-borda)', borderRadius: 10, padding: '10px 12px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', gap: 8 }}
                                      >
                                        <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--cinza-texto)' }}>Cor do caminho</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                                          {GW_PALETTE.map(color => (
                                            <button
                                              key={color}
                                              onClick={() => { updateBranch(stepGateway.id, branch.id, 'color', color); setGwColorPicker(null) }}
                                              style={{ width: 22, height: 22, borderRadius: '50%', background: color, border: branch.color === color ? '2px solid #0A0A0A' : '2px solid transparent', cursor: 'pointer', outline: 'none' }}
                                            />
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <input
                                    style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, fontWeight: 500, color: 'var(--preto)', border: 'none', outline: 'none', background: 'transparent', width: 120 }}
                                    placeholder={`Caminho ${bi + 1}`}
                                    value={branch.label}
                                    onChange={e => updateBranch(stepGateway.id, branch.id, 'label', e.target.value)}
                                  />
                                  {stepGateway.branches.length > 2 && (
                                    <button onClick={() => removeBranch(stepGateway.id, branch.id)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cinza-texto)', fontSize: 14, lineHeight: 1 }} title="Remover caminho">×</button>
                                  )}
                                </div>

                                {branch.steps.length > 0 && (
                                  <div style={{ marginLeft: 28, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {branch.steps.map(bs => (
                                      <div key={bs.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', background: '#F8F8F8', borderRadius: 8, borderLeft: `2px solid ${branch.color}` }}>
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                          {lanes.length >= 2 && (
                                            <select
                                              value={bs.laneId}
                                              onChange={e => updateBranchStep(stepGateway.id, branch.id, bs.id, 'laneId', e.target.value)}
                                              className="step-lane-select"
                                              style={{ marginTop: 0, marginBottom: 2 }}
                                            >
                                              {lanes.map((l, i) => (
                                                <option key={l.id} value={l.id}>{l.title || `Raia ${i + 1}`}</option>
                                              ))}
                                            </select>
                                          )}
                                          <input
                                            style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, fontWeight: 500, color: 'var(--preto)', border: 'none', outline: 'none', background: 'transparent', width: '100%' }}
                                            placeholder="Nome da etapa"
                                            value={bs.title}
                                            onChange={e => updateBranchStep(stepGateway.id, branch.id, bs.id, 'title', e.target.value)}
                                          />
                                          <AutoResizeTextarea
                                            className="step-desc-input"
                                            placeholder="Descrição..."
                                            value={bs.description}
                                            onChange={v => updateBranchStep(stepGateway.id, branch.id, bs.id, 'description', v)}
                                          />
                                        </div>
                                        <button onClick={() => removeBranchStep(stepGateway.id, branch.id, bs.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cinza-texto)', fontSize: 14, lineHeight: 1, paddingTop: 2 }}>×</button>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                <button
                                  onClick={() => addBranchStep(stepGateway.id, branch.id)}
                                  style={{ marginLeft: 28, display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: 'var(--cinza-medio)', padding: '2px 0' }}
                                >
                                  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width={12} height={12}>
                                    <line x1="7" y1="2" x2="7" y2="12"/><line x1="2" y1="7" x2="12" y2="7"/>
                                  </svg>
                                  Adicionar etapa ao caminho
                                </button>
                              </div>
                            ))}
                          </div>

                          <button
                            onClick={() => addBranch(stepGateway.id)}
                            style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1.5px dashed var(--cinza-borda)', borderRadius: 6, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--cinza-texto)', padding: '5px 12px'}}
                          >
                            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width={10} height={10}>
                              <line x1="7" y1="2" x2="7" y2="12"/><line x1="2" y1="7" x2="12" y2="7"/>
                            </svg>
                            Adicionar caminho
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}

                <button className="btn-add-step" onClick={addStep}>
                  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="7" y1="2" x2="7" y2="12"/><line x1="2" y1="7" x2="12" y2="7"/>
                  </svg>
                  Adicionar etapa
                </button>
              </div>
            </div>

            {/* QUIZ */}
            <div className="card">
              <div className="card-header" style={{ borderBottom: quiz.length > 0 ? '1px solid var(--cinza-sup)' : 'none' }}>
                <div className="card-section-title">Quiz</div>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: 'var(--cinza-texto)' }}>
                  Perguntas para validar o entendimento — mínimo 70% para concluir
                </span>
              </div>

              {quiz.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {quiz.map((q, qi) => (
                    <QuizQuestionEditor
                      key={q.id}
                      question={q}
                      index={qi}
                      onChange={updated => setQuiz(prev => prev.map((x, i) => i === qi ? updated : x))}
                      onRemove={() => setQuiz(prev => prev.filter((_, i) => i !== qi))}
                    />
                  ))}
                </div>
              )}

              <div style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <button
                  onClick={() => setQuiz(prev => [...prev, {
                    id: generateId(),
                    question: '',
                    options: ['', '', '', ''],
                    correct: 0,
                  }])}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--cinza-texto)', padding: 0 }}
                >
                  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width={10} height={10}>
                    <line x1="7" y1="2" x2="7" y2="12"/><line x1="2" y1="7" x2="12" y2="7"/>
                  </svg>
                  Adicionar pergunta
                </button>

                {processId && steps.length > 0 && (
                  <button
                    onClick={async () => {
                      setQuizGenerating(true)
                      try {
                        const res = await api.post<{ questions: QuizQuestion[] }>('/api/ai/generate-quiz', {
                          processId,
                          count: 4,
                        })
                        setQuiz(res.questions)
                      } finally {
                        setQuizGenerating(false)
                      }
                    }}
                    disabled={quizGenerating}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: quizGenerating ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12, color: quizGenerating ? 'var(--cinza-fraco)' : 'var(--azul)', padding: 0 }}
                  >
                    {quizGenerating ? (
                      <>
                        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width={10} height={10} style={{ animation: 'spin 1s linear infinite' }}>
                          <path d="M7 2a5 5 0 1 1-3.5 1.5"/>
                        </svg>
                        Gerando...
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width={11} height={11}>
                          <path d="M7 1l1.5 3.5L12 6 8.5 7.5 7 11 5.5 7.5 2 6l3.5-1.5z"/>
                        </svg>
                        Gerar com IA
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* ANÁLISE DA IA */}
            <div className="card">
              <div
                className="card-header"
                style={{ borderBottom: analiseOpen ? '1px solid var(--cinza-sup)' : 'none', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => setAnaliseOpen(p => !p)}
              >
                <div className="card-section-title">Análise da IA</div>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12, background: 'var(--cinza-sup)', color: 'var(--cinza-texto)', padding: '2px 8px', borderRadius: 99 }}>
                  sugestões
                </span>
                <span style={{ marginLeft: 'auto', fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--cinza-texto)' }}>
                  {analiseOpen ? '−' : '+'}
                </span>
              </div>
              {analiseOpen && (
                <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {analise ? (
                    <>
                      <StudioAnaliseGroup label="Gargalos" items={analise.gargalos} color="#FE7451" />
                      <StudioAnaliseGroup label="Riscos" items={analise.riscos} color="#FADB02" />
                      <StudioAnaliseGroup label="Melhorias" items={analise.melhorias} color="#30BCFE" />
                    </>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: 'var(--cinza-texto)', lineHeight: 1.5 }}>
                        Nenhuma análise ainda. Clique em{' '}
                        <strong style={{ color: 'var(--preto)' }}>Refinar com IA</strong>{' '}
                        para gerar sugestões baseadas neste processo.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>}
      </div>

      {showExitModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '28px 28px', width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: -0.5, color: 'var(--preto)' }}>Descartar alterações?</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: '#666', lineHeight: 1.6 }}>As alterações não salvas serão perdidas.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={cancelLeave}>Continuar editando</button>
              <button className="btn-danger" onClick={confirmLeave}>Descartar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function QuizQuestionEditor({
  question: q, index, onChange, onRemove,
}: {
  question: QuizQuestion
  index: number
  onChange: (updated: QuizQuestion) => void
  onRemove: () => void
}) {
  return (
    <div style={{ padding: '16px 24px', borderTop: '1px solid var(--cinza-sup)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12, color: '#A0A0A0', paddingTop: 11, flexShrink: 0 }}>
          {String(index + 1).padStart(2, '0')}
        </span>
        <input
          className="field-input"
          style={{ flex: 1, fontSize: 13 }}
          placeholder="Pergunta..."
          value={q.question}
          onChange={e => onChange({ ...q, question: e.target.value })}
        />
        <button
          onClick={onRemove}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C0C0C0', fontSize: 18, lineHeight: 1, padding: '4px', borderRadius: 4, flexShrink: 0 }}
        >×</button>
      </div>
      <div style={{ paddingLeft: 26, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {q.options.map((opt, oi) => (
          <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => onChange({ ...q, correct: oi as 0 | 1 | 2 | 3 })}
              style={{
                width: 16, height: 16, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                border: `2px solid ${q.correct === oi ? '#30BCFE' : '#D0D0D0'}`,
                background: q.correct === oi ? '#30BCFE' : '#fff',
                transition: 'all 0.12s',
              }}
              title="Marcar como correta"
            />
            <input
              className="field-input"
              style={{ flex: 1, fontSize: 12.5 }}
              placeholder={`Opção ${oi + 1}${oi === 0 ? ' — marque o círculo para indicar a correta' : ''}`}
              value={opt}
              onChange={e => {
                const opts = [...q.options] as [string, string, string, string]
                opts[oi] = e.target.value
                onChange({ ...q, options: opts })
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function StudioAnaliseGroup({ label, items, color }: { label: string; items: string[]; color: string }) {
  if (items.length === 0) return null
  return (
    <div>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--cinza-texto)', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((item, i) => (
          <div
            key={i}
            style={{
              padding: '8px 12px',
              background: `${color}0D`,
              borderLeft: `2px solid ${color}`,
              borderRadius: '0 6px 6px 0',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12.5,
              color: '#444',
              lineHeight: 1.5,
            }}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}
