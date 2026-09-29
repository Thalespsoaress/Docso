import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import Sidebar from '../components/Sidebar'
import BrandLoader from '../components/BrandLoader'

type Status = 'pending' | 'in_progress' | 'completed'

type Assignment = {
  id: string
  status: Status
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  assignee: { id: string; name: string; email: string }
  process: { id: string; title: string }
}

const STATUS: Record<Status, { label: string; className: string }> = {
  pending: { label: 'Não iniciado', className: 'status-pendente' },
  in_progress: { label: 'Em andamento', className: 'status-andamento' },
  completed: { label: 'Concluído', className: 'status-concluido' },
}

const PARADO_DIAS = 7
const GRID = '1fr 1fr 130px 150px'

function diasDesde(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

function haDias(n: number) {
  return n === 0 ? 'hoje' : n === 1 ? 'há 1 dia' : `há ${n} dias`
}

function andamento(a: Assignment) {
  if (a.status === 'completed' && a.completedAt) {
    return { texto: `Concluído em ${new Date(a.completedAt).toLocaleDateString('pt-BR')}`, parado: false }
  }
  const desde = a.status === 'in_progress' && a.startedAt ? a.startedAt : a.createdAt
  const dias = diasDesde(desde)
  return {
    texto: `${a.status === 'in_progress' ? 'Iniciado' : 'Enviado'} ${haDias(dias)}`,
    parado: dias >= PARADO_DIAS,
  }
}

export default function TreinamentosPage() {
  const navigate = useNavigate()
  const [filtro, setFiltro] = useState<Status | 'all'>('all')

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['training-assignments'],
    queryFn: () => api.get<Assignment[]>('/api/training'),
  })

  const count = (s: Status) => assignments.filter(a => a.status === s).length
  const concluidos = count('completed')
  const taxa = assignments.length > 0 ? Math.round((concluidos / assignments.length) * 100) : 0
  const visiveis = filtro === 'all' ? assignments : assignments.filter(a => a.status === filtro)

  const filtros: { key: Status | 'all'; label: string; n: number }[] = [
    { key: 'all', label: 'Todos', n: assignments.length },
    { key: 'pending', label: 'Não iniciados', n: count('pending') },
    { key: 'in_progress', label: 'Em andamento', n: count('in_progress') },
    { key: 'completed', label: 'Concluídos', n: concluidos },
  ]

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <div className="main-inner">

          <div className="topbar">
            <div>
              <div className="greeting-label">— Equipe</div>
              <div className="greeting-title"><span className="brand-dot">Treinamentos</span></div>
            </div>
          </div>

          {isLoading ? (
            <div style={{ height: 320 }}><BrandLoader inline /></div>
          ) : assignments.length === 0 ? (
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: 'var(--cinza-texto)', lineHeight: 1.7 }}>
              Nenhum treinamento atribuído ainda.<br />
              Abra um processo publicado e use "Atribuir treinamento".
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 40 }}>
                <Numero label="Não iniciados" valor={count('pending')} />
                <Numero label="Em andamento" valor={count('in_progress')} />
                <Numero label="Concluídos" valor={concluidos} />
                <Numero label="Taxa de conclusão" valor={`${taxa}%`} />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                {filtros.map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFiltro(f.key)}
                    style={{
                      padding: '6px 12px', borderRadius: 99, cursor: 'pointer',
                      fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12,
                      border: '1px solid', borderColor: filtro === f.key ? 'var(--preto)' : 'var(--cinza-borda)',
                      background: filtro === f.key ? 'var(--preto)' : '#fff',
                      color: filtro === f.key ? 'var(--branco)' : 'var(--cinza-medio)',
                    }}
                  >
                    {f.label} <span style={{ opacity: 0.6 }}>{f.n}</span>
                  </button>
                ))}
              </div>

              <div className="list-header" style={{ gridTemplateColumns: GRID }}>
                <div className="list-col-label">Pessoa</div>
                <div className="list-col-label">Processo</div>
                <div className="list-col-label">Status</div>
                <div className="list-col-label">Andamento</div>
              </div>
              {visiveis.map(a => {
                const st = STATUS[a.status] ?? STATUS.pending
                const and = andamento(a)
                return (
                  <div
                    key={a.id}
                    className="list-row"
                    style={{ gridTemplateColumns: GRID }}
                    onClick={() => navigate({ to: '/processo/$id', params: { id: a.process.id } })}
                  >
                    <div>
                      <div className="list-name">{a.assignee.name}</div>
                      <div className="list-date" style={{ marginTop: 2 }}>{a.assignee.email}</div>
                    </div>
                    <div className="list-name" style={{ fontWeight: 400 }}>{a.process.title}</div>
                    <div className={`status-pill ${st.className}`}><div className="dot" />{st.label}</div>
                    <div className="list-date" style={and.parado ? { color: 'var(--vermelho-texto)' } : undefined}>
                      {and.texto}
                    </div>
                  </div>
                )
              })}
            </>
          )}

        </div>
      </main>
    </div>
  )
}

function Numero({ label, valor }: { label: string; valor: number | string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--cinza-borda)', borderRadius: 10, padding: '18px 20px' }}>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--cinza-texto)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 28, letterSpacing: -1, color: 'var(--preto)' }}>{valor}</div>
    </div>
  )
}
