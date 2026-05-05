import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { api } from '../lib/api'
import { useCurrentUser } from '../hooks/useCurrentUser'
import Sidebar from '../components/Sidebar'

type Status = 'published' | 'draft' | 'archived'

type Process = {
  id: string
  title: string
  executor: string | null
  status: Status
  updatedAt: string
  stepsCount: number
}

type ApiProcess = {
  id: string
  title: string
  executor: string | null
  status: string
  updatedAt: string
  creator: { id: string; name: string }
  steps: unknown[]
}

function toProcess(p: ApiProcess): Process {
  const statusMap: Record<string, Status> = {
    published: 'published',
    draft: 'draft',
    archived: 'archived',
  }
  return {
    id: p.id,
    title: p.title,
    executor: p.executor,
    status: statusMap[p.status] ?? 'draft',
    updatedAt: new Date(p.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }),
    stepsCount: Array.isArray(p.steps) ? p.steps.length : 0,
  }
}

const STATUS_LABEL: Record<Status, string> = {
  published: 'Publicado',
  draft: 'Rascunho',
  archived: 'Desatualizado',
}

const STATUS_CLASS: Record<Status, string> = {
  published: 'status-publicado',
  draft: 'status-rascunho',
  archived: 'status-desatualizado',
}

function StatusPill({ status }: { status: Status }) {
  return (
    <div className={`status-pill ${STATUS_CLASS[status]}`}>
      <div className="dot" />
      {STATUS_LABEL[status]}
    </div>
  )
}

function ListRow({
  process: p,
  onNavigate,
}: {
  process: Process
  onNavigate: (id: string) => void
}) {
  return (
    <div
      className="list-row"
      style={{ borderBottom: '1px solid var(--cinza-borda)', borderRadius: 0 }}
      onClick={() => onNavigate(p.id)}
    >
      <div className="list-name">{p.title}</div>
      <div className="list-area">{p.executor ?? '—'}</div>
      <StatusPill status={p.status} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
        <div className="list-date">{p.updatedAt}</div>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-card-header">
        <div className="skeleton-line" style={{ height: 16, width: '60%' }} />
        <div className="skeleton-line" style={{ height: 20, width: 72, borderRadius: 99 }} />
      </div>
      <div className="skeleton-card-footer">
        <div className="skeleton-line" style={{ height: 20, width: 64, borderRadius: 4 }} />
        <div className="skeleton-line" style={{ height: 12, width: 80 }} />
      </div>
    </div>
  )
}

export default function BibliotecaPage() {
  const { name } = useCurrentUser()
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'cards' | 'list'>('cards')
  const navigate = useNavigate()

  const firstName = name.split(' ')[0] || 'você'

  const { data: processes = [], isLoading } = useQuery({
    queryKey: ['processes'],
    queryFn: () => api.get<ApiProcess[]>('/api/processes').then(list => list.map(toProcess)),
  })

  const filtered = useMemo(() => {
    if (!query.trim()) return processes
    const q = query.toLowerCase()
    return processes.filter(p =>
      p.title.toLowerCase().includes(q) || (p.executor ?? '').toLowerCase().includes(q)
    )
  }, [query, processes])

  const sectionLabel = query.trim() ? `— Resultados para "${query}"` : '— Todos os processos'

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />

      <main className="main">
        <div className="main-inner">

          {/* TOPBAR */}
          <div className="topbar">
            <div>
              <div className="greeting-label">— Home</div>
              <div className="greeting-title">Olá, {firstName}.</div>
            </div>
          </div>

          {/* TOOLBAR */}
          <div className="toolbar">
            <div className="search-wrap">
              <div className="search-icon">
                <svg viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="6.5" cy="6.5" r="4.5"/>
                  <line x1="10" y1="10" x2="14" y2="14"/>
                </svg>
              </div>
              <input
                type="text"
                className="search-input"
                placeholder="Buscar processo..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>

            <div className="toolbar-right">
              <div className="results-count">
                {filtered.length} processo{filtered.length !== 1 ? 's' : ''}
              </div>
              <div className="view-toggle">
                <button
                  className={`vt-btn${view === 'cards' ? ' active' : ''}`}
                  onClick={() => setView('cards')}
                  title="Cards"
                >
                  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="1" width="5" height="5" rx="1"/>
                    <rect x="8" y="1" width="5" height="5" rx="1"/>
                    <rect x="1" y="8" width="5" height="5" rx="1"/>
                    <rect x="8" y="8" width="5" height="5" rx="1"/>
                  </svg>
                </button>
                <button
                  className={`vt-btn${view === 'list' ? ' active' : ''}`}
                  onClick={() => setView('list')}
                  title="Lista"
                >
                  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <line x1="1" y1="3" x2="13" y2="3"/>
                    <line x1="1" y1="7" x2="13" y2="7"/>
                    <line x1="1" y1="11" x2="13" y2="11"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* SECTION LABEL */}
          {!isLoading && (
            <div className="section-label">{sectionLabel}</div>
          )}

          {/* SKELETON LOADING */}
          {isLoading && (
            <div className="cards-grid">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          )}

          {/* ESTADO VAZIO — sem resultados */}
          {!isLoading && filtered.length === 0 && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '80px 0', gap: '12px',
            }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: '18px', letterSpacing: '-0.5px', color: 'var(--preto)' }}>
                {query.trim() ? 'Nenhum resultado.' : 'Nenhum processo ainda.'}
              </div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13.5px', color: 'var(--cinza-texto)', lineHeight: 1.6, textAlign: 'center', maxWidth: '320px' }}>
                {query.trim()
                  ? `Nenhum processo corresponde a "${query}".`
                  : 'Crie o primeiro processo do seu time clicando em "Novo processo".'}
              </div>
            </div>
          )}

          {/* CARDS VIEW */}
          {!isLoading && view === 'cards' && filtered.length > 0 && (
            <div className="cards-grid">
              {filtered.map(p => (
                <div className="process-card" key={p.id} onClick={() => navigate({ to: '/processo/$id', params: { id: p.id } })}>
                  <div className="card-header">
                    <div className="card-name">{p.title}</div>
                    <StatusPill status={p.status} />
                  </div>
                  <div className="card-footer">
                    <div className="card-area">
                      <div className="area-tag">{p.executor ?? '—'}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {p.stepsCount > 0 && (
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 1, color: '#C8C8C8' }}>
                          {p.stepsCount} etapa{p.stepsCount !== 1 ? 's' : ''}
                        </div>
                      )}
                      <div className="card-date">{p.updatedAt}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* LIST VIEW */}
          {!isLoading && view === 'list' && filtered.length > 0 && (
            <div className="list-view" style={{ display: 'block' }}>
              <div className="list-header">
                <div className="list-col-label">Nome</div>
                <div className="list-col-label">Área</div>
                <div className="list-col-label">Status</div>
                <div className="list-col-label">Atualizado em</div>
              </div>
              <div>
                {filtered.map(p => (
                  <ListRow
                    key={p.id}
                    process={p}
                    onNavigate={id => navigate({ to: '/processo/$id', params: { id } })}
                  />
                ))}
              </div>
            </div>
          )}

        </div>
      </main>

    </div>
  )
}
