import { useState, useRef, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { api } from '../lib/api'
import Sidebar from '../components/Sidebar'

// display: texto mostrado no chat quando content leva contexto extra pra IA
type Message = { role: 'user' | 'assistant'; content: string; display?: string }

type ProcessoStep = {
  order: number
  title: string
  description: string
  notes?: string
  sectionTitle?: string
  sectionIndex?: number
}

type Analise = {
  gargalos: string[]
  riscos: string[]
  melhorias: string[]
}

type ProcessoGerado = {
  title: string
  objective: string
  executor: string
  frequency?: string
  steps: ProcessoStep[]
  analise: Analise
}

type Marca = 'nova' | 'alterada'

type AnaliseInicial = {
  resumo: string
  gargalos: string[]
  riscos: string[]
  melhorias: string[]
  pergunta: string
}

type ApiResponse =
  | { type: 'message'; content: string }
  | ({ type: 'processo' } & Omit<ProcessoGerado, never>)
  | ({ type: 'analise_inicial' } & AnaliseInicial)

const PRIMEIRA_MENSAGEM =
  'Vamos mapear um processo. Para começar: qual é o nome do processo que você quer documentar, e qual é o objetivo principal dele?'

const STORAGE_KEY = 'docso-mapeamento-session'

function buildAnaliseMessage(processo: ProcessoGerado): Message {
  const { analise, title } = processo
  const lines: string[] = [`Retomando o mapeamento de "${title}". Segue a análise:`]
  if (analise.gargalos.length > 0) {
    lines.push('\nGargalos:')
    analise.gargalos.forEach(g => lines.push(`• ${g}`))
  }
  if (analise.riscos.length > 0) {
    lines.push('\nRiscos:')
    analise.riscos.forEach(r => lines.push(`• ${r}`))
  }
  if (analise.melhorias.length > 0) {
    lines.push('\nMelhorias sugeridas:')
    analise.melhorias.forEach(m => lines.push(`• ${m}`))
  }
  lines.push('\nO que você gostaria de ajustar?')
  return { role: 'assistant', content: lines.join('\n') }
}

type ProcessoContexto = {
  processId?: string | null
  title: string
  objective?: string | null
  executor?: string | null
  frequency?: string | null
  steps: Array<{ order: number; title: string; description?: string; sectionTitle?: string }>
}

function buildContextMessage(p: ProcessoContexto): string {
  const lines = ['Preciso que você analise e ajude a refinar o seguinte processo:\n']
  lines.push(`Nome: ${p.title}`)
  if (p.objective) lines.push(`Objetivo: ${p.objective}`)
  if (p.executor) lines.push(`Executor: ${p.executor}`)
  if (p.frequency) lines.push(`Frequência: ${p.frequency}`)
  lines.push('\nEtapas:')
  p.steps.forEach(s => {
    const raia = s.sectionTitle ? `[${s.sectionTitle}] ` : ''
    lines.push(`${String(s.order).padStart(2, '0')}. ${raia}${s.title}`)
    if (s.description) lines.push(`    ${s.description}`)
  })
  return lines.join('\n')
}

function loadInitialState(): { messages: Message[]; processoGerado: ProcessoGerado | null; processoContexto: ProcessoContexto | null } {
  const defaultMessages = [{ role: 'assistant' as const, content: PRIMEIRA_MENSAGEM }]

  // Refinar a partir de processo existente (Studio → Mapear com IA)
  const processoRaw = sessionStorage.getItem('mapeamento-processo')
  if (processoRaw) {
    sessionStorage.removeItem('mapeamento-processo')
    localStorage.removeItem(STORAGE_KEY)
    try {
      const processoContexto = JSON.parse(processoRaw) as ProcessoContexto
      return { messages: [], processoGerado: null, processoContexto }
    } catch { /* ignore */ }
  }

  // Retomar sessão existente (com possível flag de refinar análise anterior)
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return { messages: defaultMessages, processoGerado: null, processoContexto: null }

    const { messages: savedMsgs, processoGerado: savedProcesso } = JSON.parse(saved) as {
      messages?: Message[]
      processoGerado?: ProcessoGerado | null
    }

    const base = Array.isArray(savedMsgs) && savedMsgs.length > 1 ? savedMsgs : defaultMessages
    const refinar = sessionStorage.getItem('mapeamento-refinar') === '1'
    if (refinar) sessionStorage.removeItem('mapeamento-refinar')

    if (refinar && savedProcesso) {
      return { messages: [...base, buildAnaliseMessage(savedProcesso)], processoGerado: null, processoContexto: null }
    }

    return { messages: base, processoGerado: savedProcesso ?? null, processoContexto: null }
  } catch {
    return { messages: defaultMessages, processoGerado: null, processoContexto: null }
  }
}

export default function MapeamentoPage() {
  const navigate = useNavigate()
  const initialRef = useRef(loadInitialState())
  const [messages, setMessages] = useState<Message[]>(initialRef.current.messages)
  const [processoGerado, setProcessoGerado] = useState<ProcessoGerado | null>(initialRef.current.processoGerado)
  const [analiseInicial, setAnaliseInicial] = useState<AnaliseInicial | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(!!initialRef.current.processoContexto)
  const [creating, setCreating] = useState(false)
  // Marcas por título: sobrevivem à renumeração quando a IA insere etapas
  const [marcas, setMarcas] = useState<Record<string, Marca>>({})
  const etapasAntesRef = useRef<ProcessoStep[] | null>(null)
  const refinarProcessIdRef = useRef<string | null>(initialRef.current.processoContexto?.processId ?? null)
  const refinarPrefixRef = useRef<{ context: string; pergunta: string } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-envia contexto do processo ao abrir via "Refinar com IA" no Studio
  useEffect(() => {
    const ctx = initialRef.current.processoContexto
    if (!ctx) return

    const contextMsg = buildContextMessage(ctx)
    api.post<ApiResponse>('/api/ai/mapear', {
      messages: [{ role: 'user', content: contextMsg }],
      mode: 'refinar',
    }).then(res => {
      if (res.type === 'analise_inicial') {
        refinarPrefixRef.current = { context: contextMsg, pergunta: res.pergunta }
        setAnaliseInicial(res)
        setMessages([{ role: 'assistant', content: res.pergunta }])
      } else if (res.type === 'message') {
        refinarPrefixRef.current = { context: contextMsg, pergunta: res.content }
        setMessages([{ role: 'assistant', content: res.content }])
      } else if (res.type === 'processo') {
        const { type: _, ...data } = res
        setProcessoGerado(data as ProcessoGerado)
      }
    }).catch(() => {
      setMessages([{ role: 'assistant', content: 'Erro ao analisar o processo. Tente novamente.' }])
    }).finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, processoGerado }))
    } catch { /* ignore */ }
  }, [messages, processoGerado])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, processoGerado])

  function handleSend() {
    const text = input.trim()
    if (!text || loading || processoGerado) return
    setInput('')
    enviar(messages, { role: 'user', content: text })
  }

  async function enviar(historico: Message[], msg: Message) {
    const newMessages: Message[] = [...historico, msg]
    setMessages(newMessages)
    setLoading(true)

    try {
      const firstUserIdx = newMessages.findIndex(m => m.role === 'user')
      const sliced = firstUserIdx >= 0 ? newMessages.slice(firstUserIdx) : newMessages
      const prefix = refinarPrefixRef.current
        ? [
            { role: 'user' as const, content: refinarPrefixRef.current.context },
            { role: 'assistant' as const, content: refinarPrefixRef.current.pergunta },
          ]
        : []
      const apiMessages = [...prefix, ...sliced].map(m => ({ role: m.role, content: m.content }))
      const res = await api.post<ApiResponse>('/api/ai/mapear', {
        messages: apiMessages,
        ...(refinarProcessIdRef.current && { mode: 'refinar' }),
      })

      if (res.type === 'message') {
        setMessages(prev => [...prev, { role: 'assistant', content: res.content }])
      } else {
        const { type: _, ...data } = res
        const novo = data as ProcessoGerado
        const antes = etapasAntesRef.current
        if (antes) {
          // ponytail: compara por título; etapa renomeada pela IA aparece como "nova"
          const novas: Record<string, Marca> = {}
          novo.steps.forEach(s => {
            const old = antes.find(o => o.title === s.title)
            if (!old) novas[s.title] = 'nova'
            else if (old.description !== s.description || (old.notes ?? '') !== (s.notes ?? '')) novas[s.title] = 'alterada'
          })
          setMarcas(novas)
          etapasAntesRef.current = null
        }
        setProcessoGerado(novo)
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Ocorreu um erro. Pode tentar novamente?' },
      ])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  async function handleCriar() {
    if (!processoGerado || creating) return
    setCreating(true)
    try {
      const created = await api.post<{ id: string }>('/api/processes', {
        title: processoGerado.title,
        objective: processoGerado.objective || null,
        executor: processoGerado.executor || null,
        frequency: processoGerado.frequency || null,
        steps: processoGerado.steps,
        metadata: { analise: processoGerado.analise },
        status: 'draft',
      })
      navigate({ to: '/studio/$id', params: { id: created.id } })
    } catch {
      setCreating(false)
    }
  }

  async function handleAtualizar() {
    if (!processoGerado || creating) return
    const pid = refinarProcessIdRef.current
    if (!pid) return
    setCreating(true)
    try {
      await api.patch(`/api/processes/${pid}`, {
        title: processoGerado.title,
        objective: processoGerado.objective || null,
        executor: processoGerado.executor || null,
        frequency: processoGerado.frequency || null,
        steps: processoGerado.steps,
        metadata: { analise: processoGerado.analise },
      })
      navigate({ to: '/studio/$id', params: { id: pid } })
    } catch {
      setCreating(false)
    }
  }

  function continuarComMelhorias(melhorias: string[]) {
    if (!processoGerado) return
    const { steps, analise } = processoGerado
    const pontos = [...analise.gargalos, ...analise.riscos]
    const lista = melhorias.map(m => `• ${m}`).join('\n')
    const content = [
      `Quero aplicar estas melhorias na versão atual do processo:\n${lista}`,
      pontos.length > 0 ? `Pontos de atenção a registrar nas etapas:\n${pontos.map(p => `• ${p}`).join('\n')}` : '',
      `Versão atual do processo "${processoGerado.title}":\n${JSON.stringify(steps, null, 2)}`,
    ].filter(Boolean).join('\n\n')

    etapasAntesRef.current = steps
    setMarcas({})
    setProcessoGerado(null)
    enviar(messages, { role: 'user', content, display: `Quero aplicar estas melhorias:\n${lista}` })
  }

  function descartarSugestao(tipo: keyof Analise, item: string) {
    setProcessoGerado(prev => prev && {
      ...prev,
      analise: { ...prev.analise, [tipo]: prev.analise[tipo].filter(x => x !== item) },
    })
  }

  function resetSession() {
    localStorage.removeItem(STORAGE_KEY)
    setMarcas({})
    etapasAntesRef.current = null
    setMessages([{ role: 'assistant', content: PRIMEIRA_MENSAGEM }])
    setInput('')
    setProcessoGerado(null)
    setAnaliseInicial(null)
    refinarPrefixRef.current = null
    refinarProcessIdRef.current = null
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function updateStep(order: number, field: 'title' | 'description' | 'notes', value: string) {
    setProcessoGerado(prev =>
      prev ? { ...prev, steps: prev.steps.map(s => s.order === order ? { ...s, [field]: value } : s) } : prev
    )
  }

  return (
    <div className="app-shell">
      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F2F2F2' }}>

        {/* Topbar */}
        <div className="process-topbar">
          <div className="breadcrumb">
            <span
              style={{ cursor: 'pointer', color: 'var(--cinza-texto)' }}
              onClick={() => navigate({ to: '/studio' })}
            >
              Studio
            </span>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">Mapear com IA</span>
          </div>
        </div>

        {/* Chat area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px' }}>
          <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {analiseInicial && !processoGerado && (
              <AnaliseInicialCard analise={analiseInicial} />
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '80%',
                    padding: '12px 16px',
                    borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    background: msg.role === 'user' ? '#0A0A0A' : '#fff',
                    color: msg.role === 'user' ? '#FAFAFA' : '#0A0A0A',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 14,
                    lineHeight: 1.6,
                    border: msg.role === 'assistant' ? '1px solid #E4E4E4' : 'none',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {msg.display ?? msg.content}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '12px 12px 12px 2px',
                  background: '#fff',
                  border: '1px solid #E4E4E4',
                  display: 'flex',
                  gap: 5,
                  alignItems: 'center',
                }}>
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      style={{
                        width: 6, height: 6, borderRadius: '50%', background: '#C0C0C0',
                        animation: 'pulse 1.2s ease-in-out infinite',
                        animationDelay: `${i * 0.2}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Processo gerado — editável */}
            {processoGerado && (
              <ProcessoCard
                processo={processoGerado}
                creating={creating}
                marcas={marcas}
                temProcessoOrigem={!!refinarProcessIdRef.current}
                onUpdateTitle={v => setProcessoGerado(prev => prev ? { ...prev, title: v } : prev)}
                onUpdateStep={updateStep}
                onContinuarComMelhorias={continuarComMelhorias}
                onDescartar={descartarSugestao}
                onCriar={handleCriar}
                onAtualizar={handleAtualizar}
                onReset={resetSession}
                onContinuar={() => { setMarcas({}); setProcessoGerado(null) }}
              />
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input */}
        {!processoGerado && (
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid #E4E4E4',
            background: '#F2F2F2',
          }}>
            <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua resposta... (Enter para enviar)"
                disabled={loading}
                rows={1}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  background: '#fff',
                  border: '1px solid #E4E4E4',
                  borderRadius: 10,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 14,
                  color: '#0A0A0A',
                  resize: 'none',
                  outline: 'none',
                  lineHeight: 1.5,
                  maxHeight: 120,
                  overflowY: 'auto',
                }}
                onInput={e => {
                  const el = e.currentTarget
                  el.style.height = 'auto'
                  el.style.height = Math.min(el.scrollHeight, 120) + 'px'
                }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                style={{
                  width: 40, height: 40, borderRadius: 10, border: 'none',
                  background: input.trim() && !loading ? '#0A0A0A' : '#E4E4E4',
                  color: input.trim() && !loading ? '#FAFAFA' : '#A0A0A0',
                  cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'background 0.15s',
                }}
              >
                <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={14} height={14}>
                  <line x1="7" y1="12" x2="7" y2="2" />
                  <polyline points="3,6 7,2 11,6" />
                </svg>
              </button>
            </div>
            <div style={{ maxWidth: 640, margin: '6px auto 0', fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12, color: '#A0A0A0' }}>
              Enter para enviar · Shift+Enter para nova linha
            </div>
          </div>
        )}
      </div>

    </div>
  )
}

function ProcessoCard({
  processo, creating, marcas, temProcessoOrigem,
  onUpdateTitle, onUpdateStep, onContinuarComMelhorias, onDescartar, onCriar, onAtualizar, onReset, onContinuar,
}: {
  processo: ProcessoGerado
  creating: boolean
  marcas: Record<string, Marca>
  temProcessoOrigem: boolean
  onUpdateTitle: (v: string) => void
  onUpdateStep: (order: number, field: 'title' | 'description' | 'notes', value: string) => void
  onContinuarComMelhorias: (melhorias: string[]) => void
  onDescartar: (tipo: keyof Analise, item: string) => void
  onCriar: () => void
  onAtualizar: () => void
  onReset: () => void
  onContinuar: () => void
}) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null)
  const [selecionadas, setSelecionadas] = useState<string[]>([])
  const { gargalos, riscos, melhorias } = processo.analise
  const hasDiagnostico = gargalos.length > 0 || riscos.length > 0
  const totalMarcas = Object.keys(marcas).length

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #E4E4E4',
      borderRadius: 12,
      overflow: 'hidden',
      marginTop: 8,
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid #F0F0F0',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#30BCFE', flexShrink: 0 }} />
        <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 14, color: '#0A0A0A', letterSpacing: '-0.3px' }}>
          Processo mapeado
        </span>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12, color: '#A0A0A0', background: '#F0F0F0', padding: '2px 8px', borderRadius: 99 }}>
          revise antes de criar
        </span>
      </div>

      {/* Título editável */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0F0F0' }}>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12, color: '#A0A0A0', marginBottom: 6 }}>
          Nome do processo
        </div>
        <input
          value={processo.title}
          onChange={e => onUpdateTitle(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 15,
            color: '#0A0A0A', letterSpacing: '-0.3px',
            background: 'transparent', border: 'none', outline: 'none',
            borderBottom: '1.5px solid #E4E4E4', paddingBottom: 4,
          }}
        />
        {processo.executor && (
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12, color: '#A0A0A0', marginTop: 8 }}>
            {processo.executor}{processo.frequency ? ` · ${processo.frequency}` : ''}
          </div>
        )}
      </div>

      {/* Etapas editáveis */}
      <div style={{ borderBottom: '1px solid #F0F0F0' }}>
        <div style={{ padding: '10px 20px 6px', fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12, color: '#A0A0A0' }}>
          Etapas — {processo.steps.length}
        </div>
        {processo.steps.map(step => {
          const isExpanded = expandedStep === step.order
          return (
            <div key={step.order} style={{ borderTop: '1px solid #F8F8F8' }}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 20px',
                  cursor: 'pointer',
                }}
                onClick={() => setExpandedStep(isExpanded ? null : step.order)}
              >
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12, color: '#A0A0A0', flexShrink: 0, width: 18 }}>
                  {String(step.order).padStart(2, '0')}
                </span>
                {step.sectionTitle && (
                  <span style={{
                    fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12,
                    color: '#fff', background: '#0A0A0A', padding: '2px 6px', borderRadius: 4, flexShrink: 0,
                  }}>
                    {step.sectionTitle}
                  </span>
                )}
                <input
                  value={step.title}
                  onChange={e => { e.stopPropagation(); onUpdateStep(step.order, 'title', e.target.value) }}
                  onClick={e => e.stopPropagation()}
                  style={{
                    flex: 1, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500,
                    color: '#0A0A0A', background: 'transparent', border: 'none', outline: 'none',
                  }}
                />
                {marcas[step.title] && (
                  <span style={{
                    fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12,
                    color: '#0A0A0A', background: '#30BCFE26', padding: '2px 8px', borderRadius: 99, flexShrink: 0,
                  }}>
                    {marcas[step.title] === 'nova' ? 'Nova' : 'Alterada'}
                  </span>
                )}
                {step.notes && (
                  <div title="Tem ponto de atenção" style={{ width: 6, height: 6, borderRadius: '50%', background: '#FADB02', flexShrink: 0 }} />
                )}
                <svg viewBox="0 0 10 6" fill="none" stroke="#C0C0C0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  width={10} height={6}
                  style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
                  <polyline points="1,1 5,5 9,1" />
                </svg>
              </div>
              {isExpanded && (
                <div style={{ padding: '0 20px 12px 48px' }}>
                  <textarea
                    value={step.description}
                    onChange={e => onUpdateStep(step.order, 'description', e.target.value)}
                    rows={3}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: '#444',
                      lineHeight: 1.6, background: '#F8F8F8', border: '1px solid #ECECEC',
                      borderRadius: 6, padding: '8px 10px', resize: 'vertical', outline: 'none',
                    }}
                  />
                  {step.notes && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12, color: '#A0A0A0', marginBottom: 4 }}>
                        Ponto de atenção
                      </div>
                      <textarea
                        value={step.notes}
                        onChange={e => onUpdateStep(step.order, 'notes', e.target.value)}
                        rows={2}
                        style={{
                          width: '100%', boxSizing: 'border-box',
                          fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: '#444',
                          lineHeight: 1.6, background: '#FADB020D', border: 'none', borderLeft: '2px solid #FADB02',
                          borderRadius: '0 6px 6px 0', padding: '8px 10px', resize: 'vertical', outline: 'none',
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {totalMarcas > 0 && (
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#39BD3D', flexShrink: 0 }} />
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: '#444' }}>
            Melhorias aplicadas · {totalMarcas} {totalMarcas === 1 ? 'etapa alterada' : 'etapas alteradas'}. Confira as marcadas acima.
          </span>
        </div>
      )}

      {/* Diagnóstico */}
      {hasDiagnostico && (
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0F0F0' }}>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12, color: '#A0A0A0', marginBottom: 12 }}>
            Análise da IA
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <AnaliseGroup label="Gargalos" items={gargalos} color="#FE7451"
              disabled={creating} onDescartar={item => onDescartar('gargalos', item)} />
            <AnaliseGroup label="Riscos" items={riscos} color="#FADB02"
              disabled={creating} onDescartar={item => onDescartar('riscos', item)} />
          </div>
        </div>
      )}

      {/* Melhorias */}
      {melhorias.length > 0 && (
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #F0F0F0', background: '#FAFAFA' }}>
          <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 15, color: '#0A0A0A', letterSpacing: '-0.3px' }}>
            Melhorias sugeridas
          </div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: '#666', marginTop: 2, marginBottom: 14 }}>
            Escolha o que aplicar. A IA ajusta as etapas com você na conversa.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {melhorias.map(m => {
              const aplicada = selecionadas.includes(m)
              return (
                <div key={m} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  background: '#fff', borderRadius: 10, padding: '12px 14px',
                  border: `1px solid ${aplicada ? '#39BD3D' : '#E4E4E4'}`,
                  transition: 'border-color 0.15s',
                }}>
                  <span style={{ flex: 1, fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: '#0A0A0A', lineHeight: 1.55 }}>
                    {m}
                  </span>
                  <button
                    onClick={() => setSelecionadas(prev => aplicada ? prev.filter(x => x !== m) : [...prev, m])}
                    disabled={creating}
                    aria-pressed={aplicada}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexShrink: 0,
                      width: 104, // largura fixa: "Aplicar" → "✓ Aplicada" não empurra o texto
                      background: aplicada ? '#39BD3D' : '#0A0A0A', color: '#FAFAFA',
                      border: 'none', borderRadius: 8, padding: '7px 14px',
                      fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 12.5,
                      cursor: creating ? 'not-allowed' : 'pointer', transition: 'background 0.15s',
                    }}
                  >
                    {aplicada && (
                      <svg viewBox="0 0 12 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={11} height={9}>
                        <polyline points="1,5 4.5,8.5 11,1.5" />
                      </svg>
                    )}
                    {aplicada ? 'Aplicada' : 'Aplicar'}
                  </button>
                </div>
              )
            })}
          </div>
          {selecionadas.length > 0 && (
            <button
              onClick={() => onContinuarComMelhorias(selecionadas)}
              disabled={creating}
              style={{
                marginTop: 14, width: '100%',
                background: '#0A0A0A', color: '#FAFAFA', border: 'none', borderRadius: 8,
                padding: '11px 20px', fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 600, fontSize: 13, letterSpacing: '-0.2px',
                cursor: creating ? 'not-allowed' : 'pointer',
              }}
            >
              Continuar conversa com {selecionadas.length} {selecionadas.length === 1 ? 'melhoria' : 'melhorias'}
            </button>
          )}
        </div>
      )}

      {/* Ações */}
      <div style={{ padding: '14px 20px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {temProcessoOrigem ? (
          <button
            onClick={onAtualizar}
            disabled={creating}
            style={{
              background: creating ? '#E4E4E4' : '#0A0A0A',
              color: creating ? '#A0A0A0' : '#FAFAFA',
              border: 'none', borderRadius: 8,
              padding: '9px 20px', fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 600, fontSize: 13, cursor: creating ? 'not-allowed' : 'pointer',
              letterSpacing: '-0.2px',
            }}
          >
            {creating ? 'Salvando...' : 'Atualizar processo'}
          </button>
        ) : (
          <button
            onClick={onCriar}
            disabled={creating}
            style={{
              background: creating ? '#E4E4E4' : '#0A0A0A',
              color: creating ? '#A0A0A0' : '#FAFAFA',
              border: 'none', borderRadius: 8,
              padding: '9px 20px', fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 600, fontSize: 13, cursor: creating ? 'not-allowed' : 'pointer',
              letterSpacing: '-0.2px',
            }}
          >
            {creating ? 'Criando...' : 'Criar rascunho no Studio'}
          </button>
        )}
        <button
          onClick={onContinuar}
          disabled={creating}
          style={{
            background: 'none', border: '1px solid #E4E4E4', borderRadius: 8,
            padding: '9px 16px', fontFamily: "'DM Sans', sans-serif",
            fontSize: 13, color: '#0A0A0A', cursor: 'pointer',
          }}
        >
          Continuar conversa
        </button>
        <button
          onClick={onReset}
          disabled={creating}
          style={{
            background: 'none', border: '1px solid #E4E4E4', borderRadius: 8,
            padding: '9px 16px', fontFamily: "'DM Sans', sans-serif",
            fontSize: 13, color: '#666', cursor: 'pointer',
          }}
        >
          Novo mapeamento
        </button>
      </div>
    </div>
  )
}


function AnaliseInicialCard({ analise }: { analise: AnaliseInicial }) {
  const hasItems = analise.gargalos.length > 0 || analise.riscos.length > 0
  if (!hasItems) return null

  return (
    <div style={{ background: '#fff', border: '1px solid #E4E4E4', borderRadius: 12, overflow: 'hidden', marginTop: 8 }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#30BCFE', flexShrink: 0 }} />
        <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 14, color: '#0A0A0A', letterSpacing: '-0.3px' }}>
          Como o processo está hoje
        </span>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12, color: '#A0A0A0', background: '#F0F0F0', padding: '2px 8px', borderRadius: 99 }}>
          leitura inicial
        </span>
      </div>
      {analise.resumo && (
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #F0F0F0' }}>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: '#444', lineHeight: 1.7, margin: 0 }}>
            {analise.resumo}
          </p>
        </div>
      )}
      <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <AnaliseGroup label="Gargalos observados" items={analise.gargalos} color="#FE7451" />
        <AnaliseGroup label="Riscos identificados" items={analise.riscos} color="#FADB02" />
      </div>
    </div>
  )
}

function AnaliseGroup({ label, items, color, disabled, onDescartar }: {
  label: string
  items: string[]
  color: string
  disabled?: boolean
  onDescartar?: (item: string) => void
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  if (items.length === 0) return null
  return (
    <div>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12, color: '#A0A0A0', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((item, i) => (
          <div
            key={item}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{
              display: 'flex', gap: 10, alignItems: 'flex-start',
              padding: '8px 10px',
              background: `${color}0D`,
              borderLeft: `2px solid ${color}`,
              borderRadius: '0 6px 6px 0',
            }}
          >
            <span style={{ flex: 1, fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: '#444', lineHeight: 1.5 }}>
              {item}
            </span>
            {hovered === i && !disabled && onDescartar && (
              <button
                onClick={() => onDescartar(item)}
                style={{
                  flexShrink: 0, background: '#fff', border: '1px solid #E4E4E4', borderRadius: 6,
                  padding: '3px 8px', fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
                  fontSize: 12, color: '#666', cursor: 'pointer',
                }}
              >
                Descartar
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
