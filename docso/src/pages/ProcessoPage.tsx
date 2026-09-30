import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useCurrentUser } from '../hooks/useCurrentUser'
import Sidebar from '../components/Sidebar'
import BrandLoader from '../components/BrandLoader'
import FlowView, { type Step, type Gateway } from '../components/FlowView'
import { type Assignment, TRAINING_STATUS, andamento } from '../lib/training'

type Analise = {
  gargalos: string[]
  riscos: string[]
  melhorias: string[]
}

type ProcessDetail = {
  id: string
  title: string
  objective: string | null
  executor: string | null
  frequency: string | null
  status: string
  steps: Step[]
  gateways?: Gateway[]
  updatedAt: string
  creator: { id: string; name: string }
  metadata?: { analise?: Analise } | null
}

type Member = {
  id: string
  role: string
  user: { id: string; name: string; email: string }
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function AtribuirModal({
  processId,
  processTitle,
  onClose,
}: {
  processId: string
  processTitle: string
  onClose: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [feedback, setFeedback] = useState('')
  const [erro, setErro] = useState('')
  const queryClient = useQueryClient()

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => api.get<Member[]>('/api/members'),
  })

  const assign = useMutation({
    mutationFn: (userIds: string[]) =>
      api.post<{ results: { userId: string; status: string }[] }>('/api/training', {
        processId,
        userIds,
      }),
    onSuccess: (data) => {
      const atribuidos = data.results.filter(r => r.status === 'assigned').length
      const jaAtribuidos = data.results.filter(r => r.status === 'already_assigned').length
      let msg = `${atribuidos} treinamento${atribuidos !== 1 ? 's' : ''} enviado${atribuidos !== 1 ? 's' : ''}.`
      if (jaAtribuidos > 0) msg += ` ${jaAtribuidos} já ${jaAtribuidos === 1 ? 'tinha' : 'tinham'} treinamento pendente.`
      setFeedback(msg)
      setSelected(new Set())
      queryClient.invalidateQueries({ queryKey: ['training-assignments'] })
    },
    onError: () => setErro('Erro ao atribuir treinamentos. Tente novamente.'),
  })

  function toggle(userId: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  async function handleAtribuir() {
    setErro('')
    setFeedback('')
    if (selected.size === 0) { setErro('Selecione ao menos um membro'); return }
    await assign.mutateAsync(Array.from(selected))
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: '28px 28px',
        width: '100%', maxWidth: 440, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 17, letterSpacing: -0.5, color: '#0A0A0A', marginBottom: 4 }}>
          Atribuir treinamento
        </div>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: '#A0A0A0', marginBottom: 20 }}>
          {processTitle}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16, border: '1px solid #E4E4E4', borderRadius: 8, maxHeight: 280 }}>
          {members.length === 0 && (
            <div style={{ padding: '20px 16px', fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: '#A0A0A0', textAlign: 'center' }}>
              Nenhum membro na organização.
            </div>
          )}
          {members.map((m, i) => (
            <div
              key={m.id}
              onClick={() => toggle(m.user.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', cursor: 'pointer',
                borderBottom: i < members.length - 1 ? '1px solid #F0F0F0' : 'none',
                background: selected.has(m.user.id) ? 'rgba(48,188,254,0.06)' : 'transparent',
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: 5, border: '1.5px solid',
                borderColor: selected.has(m.user.id) ? '#30BCFE' : '#D0D0D0',
                background: selected.has(m.user.id) ? '#30BCFE' : '#fff',
                flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {selected.has(m.user.id) && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1.5,5 4,7.5 8.5,2.5" />
                  </svg>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 13.5, color: '#0A0A0A' }}>
                  {m.user.name}
                </div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: '#A0A0A0' }}>
                  {m.user.email}
                </div>
              </div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12, color: '#A0A0A0' }}>
                {m.role === 'admin' ? 'Admin' : m.role === 'manager' ? 'Gerente' : 'Membro'}
              </div>
            </div>
          ))}
        </div>

        {feedback && (
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: 'var(--verde-texto)', marginBottom: 12 }}>{feedback}</div>
        )}
        {erro && (
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: 'var(--vermelho-texto)', marginBottom: 12 }}>{erro}</div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ background: 'none', border: '1px solid #E4E4E4', borderRadius: 8, padding: '8px 18px', fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: '#666', cursor: 'pointer' }}
          >
            Fechar
          </button>
          <button
            onClick={handleAtribuir}
            disabled={assign.isPending || selected.size === 0}
            style={{
              background: '#0A0A0A', color: '#FAFAFA', border: 'none', borderRadius: 8,
              padding: '8px 18px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600,
              fontSize: 13, cursor: selected.size > 0 ? 'pointer' : 'not-allowed',
              opacity: selected.size > 0 ? 1 : 0.4,
            }}
          >
            {assign.isPending ? 'Enviando...' : `Enviar${selected.size > 0 ? ` (${selected.size})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

function AnaliseItem({ text, color }: { text: string; color: string }) {
  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'flex-start',
      padding: '8px 12px',
      background: `${color}0D`,
      borderLeft: `2px solid ${color}`,
      borderRadius: '0 6px 6px 0',
    }}>
      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: '#555', lineHeight: 1.5 }}>
        {text}
      </span>
    </div>
  )
}

function AnaliseSection({ analise }: { analise: Analise }) {
  const [open, setOpen] = useState(false)
  const hasContent =
    analise.gargalos.length > 0 || analise.riscos.length > 0 || analise.melhorias.length > 0
  if (!hasContent) return null

  return (
    <div style={{ marginTop: 40 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none',
          cursor: 'pointer', padding: 0, marginBottom: open ? 16 : 0,
        }}
      >
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--cinza-texto)' }}>
          — Análise da IA
        </div>
        <div style={{
          fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12,
          background: '#F0F0F0', color: '#888', padding: '2px 7px', borderRadius: 99,
        }}>
          sugestões
        </div>
        <svg
          viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
          width={10} height={10} style={{ color: '#C0C0C0', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        >
          <polyline points="2,4 6,8 10,4" />
        </svg>
      </button>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {analise.gargalos.length > 0 && (
            <div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12, color: '#A0A0A0', marginBottom: 6 }}>Gargalos</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {analise.gargalos.map((t, i) => <AnaliseItem key={i} text={t} color="#FE7451" />)}
              </div>
            </div>
          )}
          {analise.riscos.length > 0 && (
            <div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12, color: '#A0A0A0', marginBottom: 6 }}>Riscos</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {analise.riscos.map((t, i) => <AnaliseItem key={i} text={t} color="#FADB02" />)}
              </div>
            </div>
          )}
          {analise.melhorias.length > 0 && (
            <div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12, color: '#A0A0A0', marginBottom: 6 }}>Melhorias sugeridas</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {analise.melhorias.map((t, i) => <AnaliseItem key={i} text={t} color="#30BCFE" />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TreinamentoResumo({ processId }: { processId: string }) {
  const navigate = useNavigate()
  const { data = [] } = useQuery({
    queryKey: ['training-assignments', processId],
    queryFn: () => api.get<Assignment[]>(`/api/training?processId=${processId}`),
  })

  // Uma linha por pessoa, a atribuição mais recente vence (API ordena por createdAt desc, Map mantém o último set)
  const porPessoa = [...new Map([...data].reverse().map(a => [a.assignee.id, a] as const)).values()]
  if (porPessoa.length === 0) return null

  const concluidos = porPessoa.filter(a => a.status === 'completed').length
  const faltam = porPessoa.filter(a => a.status !== 'completed')
  const pct = Math.round((concluidos / porPessoa.length) * 100)

  return (
    <div style={{ background: '#fff', border: '1.5px solid var(--cinza-borda)', borderRadius: 10, padding: '18px 20px', marginBottom: 48, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--cinza-texto)', marginBottom: 4 }}>Treinamento</div>
          <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 15, letterSpacing: -0.3, color: 'var(--preto)' }}>
            {concluidos} de {porPessoa.length} {porPessoa.length === 1 ? 'concluiu' : 'concluíram'}
          </div>
        </div>
        <button
          onClick={() => navigate({ to: '/treinamentos', search: { processo: processId } })}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: 'var(--azul-texto)', whiteSpace: 'nowrap' }}
        >
          Ver no painel →
        </button>
      </div>
      <div className="prog-bar"><div className="prog-fill" style={{ width: `${pct}%`, background: 'var(--verde)' }} /></div>

      {faltam.length === 0 ? (
        <div style={{ marginTop: 12, fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: 'var(--verde-texto)' }}>Todos concluíram.</div>
      ) : (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {faltam.slice(0, 5).map(a => {
            const st = TRAINING_STATUS[a.status] ?? TRAINING_STATUS.pending
            const and = andamento(a)
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 10px' }}>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--preto)', flex: 1, minWidth: 120 }}>{a.assignee.name}</span>
                <span className={`status-pill ${st.className}`}><span className="dot" />{st.label}</span>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: and.parado ? 'var(--vermelho-texto)' : 'var(--cinza-texto)', minWidth: 110, textAlign: 'right' }}>{and.texto}</span>
              </div>
            )
          })}
          {faltam.length > 5 && (
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: 'var(--cinza-texto)' }}>+ {faltam.length - 5} pendentes</div>
          )}
        </div>
      )}
    </div>
  )
}

const STATUS_CLASS: Record<string, string> = {
  published: 'status-publicado',
  draft: 'status-rascunho',
  archived: 'status-desatualizado',
}

const STATUS_LABEL: Record<string, string> = {
  published: 'Publicado',
  draft: 'Rascunho',
  archived: 'Desatualizado',
}


export default function ProcessoPage() {
  const { id } = useParams({ from: '/processo/$id' })
  const navigate = useNavigate()
  const { role } = useCurrentUser()
  const [tab, setTab] = useState<'doc' | 'flow'>('doc')
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set())
  const [copied, setCopied] = useState(false)
  const [activeStep, setActiveStep] = useState<number | null>(null)
  const [showAtribuir, setShowAtribuir] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const canAssign = role === 'admin' || role === 'manager'

  function handleCompartilhar() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const { data: process, isLoading } = useQuery({
    queryKey: ['process', id],
    queryFn: () => api.get<ProcessDetail>(`/api/processes/${id}`),
  })

  const steps: Step[] = Array.isArray(process?.steps) ? (process.steps as Step[]) : []
  const gateways: Gateway[] = Array.isArray(process?.gateways) ? (process.gateways as Gateway[]) : []
  const progress = steps.length > 0 ? Math.round((doneSteps.size / steps.length) * 100) : 0

  function toggleStep(order: number) {
    setDoneSteps(prev => {
      const next = new Set(prev)
      if (next.has(order)) next.delete(order)
      else next.add(order)
      return next
    })
  }

  useEffect(() => {
    if (tab !== 'doc' || !contentRef.current || steps.length === 0) return
    const visible = new Map<number, boolean>()
    const io = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          const order = parseInt(entry.target.id.replace('step-', ''))
          visible.set(order, entry.isIntersecting)
        })
        const first = steps.find(s => visible.get(s.order))
        setActiveStep(first?.order ?? null)
      },
      { root: contentRef.current, rootMargin: '0px 0px -65% 0px', threshold: 0 },
    )
    steps.forEach(s => {
      const el = document.getElementById(`step-${s.order}`)
      if (el) io.observe(el)
    })
    return () => io.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [process?.id, tab])

  if (isLoading) return <BrandLoader />

  if (!process) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 18, color: 'var(--preto)' }}>
        Processo não encontrado.
        <button className="btn-ghost" onClick={() => navigate({ to: '/biblioteca' })}>Voltar para a Home</button>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Sidebar />

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F2F2F2' }}>

        {/* TOPBAR */}
        <div className="process-topbar">
          <div className="breadcrumb">
            <a href="#" onClick={e => { e.preventDefault(); navigate({ to: '/biblioteca' }) }}>Home</a>
            <span className="breadcrumb-sep">/</span>
            {process.executor && <><span style={{ color: '#bbb' }}>{process.executor}</span><span className="breadcrumb-sep">/</span></>}
            <span className="breadcrumb-current">{process.title}</span>
          </div>
          <div className="topbar-actions">
            {canAssign && (
              <button className="btn-ghost" onClick={() => navigate({ to: '/studio/$id', params: { id: process.id } })}>
                <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9.5V11h1.5l5-5-1.5-1.5-5 5zM10.5 3.5l-1-1a.7.7 0 0 0-1 0l-.9.9 1.5 1.5.9-.9a.7.7 0 0 0 0-1z"/></svg>
                Editar
              </button>
            )}
            {canAssign && process.status === 'published' && (
              <button className="btn-ghost" onClick={() => setShowAtribuir(true)}>
                <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="4" r="2.5"/><path d="M1 11c0-2.2 1.8-3.5 4-3.5"/><path d="M9 8v4M11 10H7"/></svg>
                Atribuir treinamento
              </button>
            )}
            <button className="btn-ghost" onClick={handleCompartilhar}>
              {copied ? (
                <>
                  <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,7 5,10 11,3"/></svg>
                  Copiado
                </>
              ) : (
                <>
                  <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="2.5" r="1.5"/><circle cx="10" cy="10.5" r="1.5"/><circle cx="3" cy="6.5" r="1.5"/><line x1="4.4" y1="7.3" x2="8.6" y2="9.7"/><line x1="8.6" y1="3.3" x2="4.4" y2="5.7"/></svg>
                  Compartilhar
                </>
              )}
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="tabs-bar">
          <button className={`tab-btn${tab === 'doc' ? ' active' : ''}`} onClick={() => setTab('doc')}>
            <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="1" width="9" height="11" rx="1.5"/><line x1="4.5" y1="4.5" x2="8.5" y2="4.5"/><line x1="4.5" y1="7" x2="8.5" y2="7"/><line x1="4.5" y1="9.5" x2="6.5" y2="9.5"/></svg>
            Documento
          </button>
          <button className={`tab-btn${tab === 'flow' ? ' active' : ''}`} onClick={() => setTab('flow')}>
            <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="1" width="4" height="3" rx="1"/><rect x="8" y="5" width="4" height="3" rx="1"/><rect x="1" y="9" width="4" height="3" rx="1"/><path d="M5 2.5h2a1 1 0 0 1 1 1v1"/><path d="M5 10.5h2a1 1 0 0 0 1-1v-1"/></svg>
            Fluxograma
          </button>
        </div>

        {/* VIEW DOC */}
        {tab === 'doc' && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div ref={contentRef} className="process-content">
              <div className="content-inner">
                <div className="process-meta">
                  {process.executor && <div className="meta-tag">{process.executor}</div>}
                  <div className={`status-pill ${STATUS_CLASS[process.status] ?? ''}`}>
                    <div className="dot" />
                    {STATUS_LABEL[process.status] ?? process.status}
                  </div>
                  <div className="meta-sep">·</div>
                  <div className="meta-date">
                    Atualizado em {new Date(process.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </div>

                <h1 className="process-title">{process.title}</h1>

                {process.objective && (
                  <p className="process-desc">{process.objective}</p>
                )}

                <div className="owners-row">
                  <div className="owners-label">Criado por</div>
                  <div className="owners-list">
                    <div className="owner-chip">
                      <div className="owner-av" style={{ background: 'var(--azul)', color: 'var(--preto)' }}>
                        {initials(process.creator.name)}
                      </div>
                      {process.creator.name}
                    </div>
                  </div>
                </div>

                {canAssign && process.status === 'published' && (
                  <TreinamentoResumo processId={process.id} />
                )}

                {steps.length > 0 && (
                  <div className="section-block">
                    <div className="section-eyebrow">— Passos</div>
                    <div className="steps-list">
                      {steps.map(s => {
                        const done = doneSteps.has(s.order)
                        return (
                          <div key={s.order} id={`step-${s.order}`} className={`step${done ? ' done' : ''}`} onClick={() => toggleStep(s.order)}>
                            <div className="step-left">
                              <div className="step-num">{s.order}</div>
                            </div>
                            <div className="step-right">
                              <div className="step-card">
                                <div className="step-header">
                                  <div className="step-name">{s.title}</div>
                                </div>
                                {s.description && <div className="step-desc">{s.description}</div>}
                                {s.notes && (
                                  <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(250,219,2,0.08)', borderRadius: 6, borderLeft: '2px solid var(--amarelo)', fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: '#888', lineHeight: 1.6 }}>
                                    {s.notes}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {steps.length === 0 && (
                  <div style={{ color: 'var(--cinza-texto)', fontFamily: "'DM Sans', sans-serif", fontSize: 14, lineHeight: 1.7 }}>
                    Este processo ainda não tem passos definidos.
                  </div>
                )}

                {/* Análise da IA */}
                {process.metadata?.analise && (
                  <AnaliseSection analise={process.metadata.analise} />
                )}
              </div>
            </div>

            {/* TOC */}
            {steps.length > 0 && (
              <div className="process-toc">
                <div className="toc-label">— Passos</div>
                {steps.map(s => (
                  <a
                    key={s.order}
                    className={`toc-item${activeStep === s.order ? ' active' : ''}`}
                    href={`#step-${s.order}`}
                    onClick={e => {
                      e.preventDefault()
                      document.getElementById(`step-${s.order}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                  >
                    <span className="toc-num">{String(s.order).padStart(2, '0')}</span>
                    {s.title}
                  </a>
                ))}
                <div className="toc-divider" />
                <div className="toc-progress">
                  <div className="toc-prog-label">
                    <span className="toc-prog-text">Progresso</span>
                    <span className="toc-prog-pct">{progress}%</span>
                  </div>
                  <div className="prog-bar">
                    <div className="prog-fill" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW FLUXOGRAMA */}
        {tab === 'flow' && steps.length > 0 && (
          <FlowView steps={steps} gateways={gateways} processId={process.id} />
        )}
        {tab === 'flow' && steps.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cinza-texto)', fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>
            Nenhum passo para exibir no fluxograma.
          </div>
        )}
      </div>

      {showAtribuir && (
        <AtribuirModal
          processId={process.id}
          processTitle={process.title}
          onClose={() => setShowAtribuir(false)}
        />
      )}
    </div>
  )
}
