import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { api } from '../lib/api'
import Sidebar from '../components/Sidebar'

type Status = 'published' | 'draft' | 'archived'

type ApiProcess = {
  id: string
  title: string
  executor: string | null
  status: string
  updatedAt: string
  steps: unknown[]
}

type Process = {
  id: string
  title: string
  executor: string | null
  status: Status
  updatedAt: string
  stepsCount: number
}

const STATUS_LABEL: Record<Status, string> = {
  published: 'Publicado',
  draft: 'Rascunho',
  archived: 'Desatualizado',
}

const STATUS_DOT: Record<Status, string> = {
  published: '#39BD3D',
  draft: '#A0A0A0',
  archived: '#FE7451',
}

function toProcess(p: ApiProcess): Process {
  const statusMap: Record<string, Status> = { published: 'published', draft: 'draft', archived: 'archived' }
  return {
    id: p.id,
    title: p.title,
    executor: p.executor,
    status: statusMap[p.status] ?? 'draft',
    updatedAt: new Date(p.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }),
    stepsCount: Array.isArray(p.steps) ? p.steps.length : 0,
  }
}

function ProcessRow({ process: p, onEdit }: { process: Process; onEdit: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 150px 130px 130px 90px',
        padding: '13px 20px',
        borderBottom: '1px solid var(--cinza-borda)',
        alignItems: 'center',
        background: hovered ? '#FAFAFA' : '#fff',
        cursor: 'pointer',
        transition: 'background 0.12s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onEdit}
    >
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500, color: 'var(--preto)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 16 }}>
        {p.title}
      </div>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: 'var(--cinza-texto)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {p.executor ?? '—'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_DOT[p.status], flexShrink: 0 }} />
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: 'var(--cinza-texto)' }}>{STATUS_LABEL[p.status]}</span>
      </div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: 'var(--cinza-texto)' }}>
        {p.updatedAt}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12.5,
            fontWeight: 500,
            color: hovered ? 'var(--preto)' : 'transparent',
            background: 'transparent',
            border: `1px solid ${hovered ? 'var(--cinza-borda)' : 'transparent'}`,
            borderRadius: 6,
            padding: '5px 14px',
            cursor: 'pointer',
            transition: 'color 0.12s, border-color 0.12s',
          }}
          onClick={e => { e.stopPropagation(); onEdit() }}
        >
          Editar
        </button>
      </div>
    </div>
  )
}

export default function StudioLandingPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

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

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#F2F2F2' }}>

        <div className="process-topbar">
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--cinza-texto)' }}>
            Studio
          </div>
          <div style={{ flex: 1 }} />
          <div className="topbar-actions">
            <button className="btn-solid" onClick={() => navigate({ to: '/studio/novo' })}>
              <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width={11} height={11}>
                <line x1="7" y1="1" x2="7" y2="13"/><line x1="1" y1="7" x2="13" y2="7"/>
              </svg>
              Novo processo
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 380 }}>
              <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--cinza-texto)', pointerEvents: 'none' }} viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width={13} height={13}>
                <circle cx="6.5" cy="6.5" r="4.5"/><line x1="10" y1="10" x2="14" y2="14"/>
              </svg>
              <input
                type="text"
                placeholder="Buscar processo..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  paddingLeft: 36,
                  paddingRight: 14,
                  paddingTop: 9,
                  paddingBottom: 9,
                  background: '#fff',
                  border: '1px solid var(--cinza-borda)',
                  borderRadius: 8,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13.5,
                  color: 'var(--preto)',
                  outline: 'none',
                }}
              />
            </div>
            {!isLoading && (
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 1, color: 'var(--cinza-texto)', flexShrink: 0 }}>
                {filtered.length} processo{filtered.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          {isLoading && (
            <div style={{ background: '#fff', border: '1px solid var(--cinza-borda)', borderRadius: 10, overflow: 'hidden' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ padding: '16px 20px', borderBottom: i < 4 ? '1px solid var(--cinza-borda)' : 'none', display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div style={{ flex: 1, height: 13, background: '#F0F0F0', borderRadius: 4 }} />
                  <div style={{ width: 90, height: 13, background: '#F0F0F0', borderRadius: 4 }} />
                  <div style={{ width: 70, height: 18, background: '#F0F0F0', borderRadius: 99 }} />
                  <div style={{ width: 80, height: 13, background: '#F0F0F0', borderRadius: 4 }} />
                </div>
              ))}
            </div>
          )}

          {!isLoading && filtered.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid var(--cinza-borda)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 150px 130px 130px 90px',
                padding: '9px 20px',
                borderBottom: '1px solid var(--cinza-borda)',
                background: '#FAFAFA',
              }}>
                {['Nome', 'Área', 'Status', 'Atualizado', ''].map((col, i) => (
                  <div key={i} style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--cinza-texto)' }}>{col}</div>
                ))}
              </div>
              {filtered.map(p => (
                <ProcessRow
                  key={p.id}
                  process={p}
                  onEdit={() => navigate({ to: '/studio/$id', params: { id: p.id } })}
                />
              ))}
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 12 }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: '-0.5px', color: 'var(--preto)' }}>
                {query.trim() ? 'Nenhum resultado.' : 'Nenhum processo ainda.'}
              </div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: 'var(--cinza-texto)', lineHeight: 1.6, textAlign: 'center', maxWidth: 300 }}>
                {query.trim()
                  ? `Nenhum processo corresponde a "${query}".`
                  : 'Crie o primeiro processo clicando em "Novo processo".'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
