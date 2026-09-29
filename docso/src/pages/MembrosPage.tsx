import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useCurrentUser } from '../hooks/useCurrentUser'
import Sidebar from '../components/Sidebar'

type Member = {
  id: string
  role: string
  joinedAt: string
  user: { id: string; name: string; email: string }
}

type Invite = {
  id: string
  email: string
  role: string
  createdAt: string
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  manager: 'Gerente',
  member: 'Membro',
}

type InviteRow = { email: string; role: string }

export default function MembrosPage() {
  const { role } = useCurrentUser()
  const queryClient = useQueryClient()
  const isAdmin = role === 'admin'

  const [rows, setRows] = useState<InviteRow[]>([{ email: '', role: 'member' }])
  const [enviando, setEnviando] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [erro, setErro] = useState('')

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => api.get<Member[]>('/api/members'),
  })

  const { data: invites = [] } = useQuery({
    queryKey: ['invites'],
    queryFn: () => api.get<Invite[]>('/api/members/invites'),
    enabled: isAdmin,
  })

  const cancelInvite = useMutation({
    mutationFn: (id: string) => api.delete(`/api/members/invites/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invites'] }),
  })

  function updateRow(i: number, field: keyof InviteRow, value: string) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }

  function addRow() {
    setRows(prev => [...prev, { email: '', role: 'member' }])
  }

  function removeRow(i: number) {
    setRows(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleConvidar() {
    setErro('')
    setFeedback('')

    const valid = rows.filter(r => r.email.trim())
    if (valid.length === 0) { setErro('Adicione ao menos um email'); return }

    setEnviando(true)
    try {
      const res = await api.post<{ results: { email: string; status: string }[] }>(
        '/api/members/invite',
        { invites: valid }
      )

      const enviados = res.results.filter(r => r.status === 'sent').length
      const jaMembers = res.results.filter(r => r.status === 'already_member').length

      let msg = `${enviados} convite${enviados !== 1 ? 's' : ''} enviado${enviados !== 1 ? 's' : ''}.`
      if (jaMembers > 0) msg += ` ${jaMembers} já ${jaMembers === 1 ? 'é membro' : 'são membros'}.`

      setFeedback(msg)
      setRows([{ email: '', role: 'member' }])
      queryClient.invalidateQueries({ queryKey: ['invites'] })
    } catch {
      setErro('Erro ao enviar convites. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <div className="main-inner">

          <div className="topbar">
            <div>
              <div className="greeting-label">— Equipe</div>
              <div className="greeting-title"><span className="brand-dot">Membros</span></div>
            </div>
          </div>

          {/* Membros ativos */}
          <div style={{ marginBottom: 40 }}>
            <div className="section-label">— Membros ativos</div>
            <div style={{ marginTop: 12, background: '#fff', border: '1px solid var(--cinza-borda)', borderRadius: 10, overflow: 'hidden' }}>
              {members.map((m, i) => (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 20px',
                  borderBottom: i < members.length - 1 ? '1px solid var(--cinza-borda)' : 'none',
                }}>
                  <div>
                    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--preto)' }}>{m.user.name}</div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: 'var(--cinza-texto)', marginTop: 2 }}>{m.user.email}</div>
                  </div>
                  <div style={{
                    fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 12.5,
                    color: 'var(--cinza-texto)',
                  }}>
                    {ROLE_LABEL[m.role] ?? m.role}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Convites pendentes */}
          {isAdmin && invites.length > 0 && (
            <div style={{ marginBottom: 40 }}>
              <div className="section-label">— Convites pendentes</div>
              <div style={{ marginTop: 12, background: '#fff', border: '1px solid var(--cinza-borda)', borderRadius: 10, overflow: 'hidden' }}>
                {invites.map((inv, i) => (
                  <div key={inv.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 20px',
                    borderBottom: i < invites.length - 1 ? '1px solid var(--cinza-borda)' : 'none',
                  }}>
                    <div>
                      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: 'var(--preto)' }}>{inv.email}</div>
                      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: 'var(--cinza-texto)', marginTop: 2 }}>
                        {ROLE_LABEL[inv.role]} · enviado em {new Date(inv.createdAt).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                    <button
                      onClick={() => cancelInvite.mutate(inv.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cinza-texto)', fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}
                    >
                      Cancelar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Formulário de convite */}
          {isAdmin && (
            <div>
              <div className="section-label">— Convidar pessoas</div>
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 560 }}>
                {rows.map((row, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input
                      type="email"
                      placeholder="email@empresa.com"
                      value={row.email}
                      onChange={e => updateRow(i, 'email', e.target.value)}
                      style={{
                        flex: 1, padding: '9px 13px', border: '1px solid var(--cinza-borda)',
                        borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 14,
                        background: 'var(--branco)', color: 'var(--preto)', outline: 'none',
                      }}
                    />
                    <select
                      value={row.role}
                      onChange={e => updateRow(i, 'role', e.target.value)}
                      style={{
                        padding: '9px 13px', border: '1px solid var(--cinza-borda)',
                        borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 14,
                        background: 'var(--branco)', color: 'var(--preto)', outline: 'none', cursor: 'pointer',
                      }}
                    >
                      <option value="admin">Admin</option>
                      <option value="manager">Gerente</option>
                      <option value="member">Membro</option>
                    </select>
                    {rows.length > 1 && (
                      <button
                        onClick={() => removeRow(i)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cinza-texto)', fontSize: 18, lineHeight: 1, padding: '0 4px' }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}

                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button
                    onClick={addRow}
                    style={{
                      background: 'none', border: '1px dashed var(--cinza-borda)', borderRadius: 8,
                      padding: '8px 16px', fontFamily: "'DM Sans', sans-serif", fontSize: 13,
                      color: 'var(--cinza-texto)', cursor: 'pointer',
                    }}
                  >
                    + Adicionar linha
                  </button>
                  <button
                    onClick={handleConvidar}
                    disabled={enviando}
                    style={{
                      background: 'var(--preto)', color: 'var(--branco)', border: 'none',
                      borderRadius: 8, padding: '8px 20px', fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    {enviando ? 'Enviando...' : 'Enviar convites'}
                  </button>
                </div>

                {feedback && <div style={{ color: 'var(--verde-texto)', fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>{feedback}</div>}
                {erro && <div style={{ color: 'var(--vermelho-texto)', fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>{erro}</div>}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
