import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'

type Org = {
  id: string
  name: string
  slug: string
  plan: string
  createdAt: string
  memberCount: number
  onboardingDone: boolean
}

const PLAN_LABEL: Record<string, string> = {
  trial: 'Trial',
  active: 'Ativo',
  cancelled: 'Cancelado',
}

export default function DocsoAdminPage() {
  const [emailCliente, setEmailCliente] = useState('')
  const [linkGerado, setLinkGerado] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [erro, setErro] = useState('')

  const { data: orgs = [], isLoading, isError } = useQuery({
    queryKey: ['docso-admin-orgs'],
    queryFn: () => api.get<Org[]>('/api/docso-admin/orgs'),
    retry: false,
  })

  const gerarToken = useMutation({
    mutationFn: () => {
      if (!emailCliente.trim()) throw new Error('Informe o email do cliente')
      return api.post<{ link: string }>('/api/docso-admin/onboarding-token', { email: emailCliente.trim() })
    },
    onSuccess: (data) => {
      setLinkGerado(data.link)
      setCopiado(false)
      setErro('')
    },
    onError: (e: Error) => setErro(e.message || 'Erro ao gerar link'),
  })

  function copiar() {
    navigator.clipboard.writeText(linkGerado)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  if (isError) {
    return (
      <div style={styles.center}>
        <div style={{ color: '#FE7451', fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>
          Acesso negado. Seu email não está autorizado.
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--branco)', padding: '40px 48px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        <div style={{ marginBottom: 40 }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: 1, color: 'var(--cinza-texto)', textTransform: 'uppercase', marginBottom: 6 }}>— Docso</div>
          <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 28, letterSpacing: '-0.5px', color: 'var(--preto)' }}>Painel interno</div>
        </div>

        {/* Gerar link de onboarding */}
        <div style={{ marginBottom: 48, padding: '24px', border: '1px solid var(--cinza-borda)', borderRadius: 12 }}>
          <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--preto)', marginBottom: 4 }}>Novo cliente</div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: 'var(--cinza-texto)', marginBottom: 16 }}>
            Gera um link de onboarding para enviar ao cliente.
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="email"
              placeholder="email@cliente.com"
              value={emailCliente}
              onChange={e => setEmailCliente(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && gerarToken.mutate()}
              style={{
                padding: '9px 13px', border: '1px solid var(--cinza-borda)',
                borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 14,
                background: 'var(--branco)', color: 'var(--preto)', outline: 'none', width: 240,
              }}
            />
            <button
              onClick={() => gerarToken.mutate()}
              disabled={gerarToken.isPending}
              style={{
                background: 'var(--preto)', color: 'var(--branco)', border: 'none',
                borderRadius: 8, padding: '9px 18px',
                fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}
            >
              {gerarToken.isPending ? 'Gerando...' : 'Gerar link'}
            </button>

            {linkGerado && (
              <>
                <input
                  readOnly
                  value={linkGerado}
                  style={{
                    flex: 1, minWidth: 200, padding: '9px 13px',
                    border: '1px solid var(--cinza-borda)', borderRadius: 8,
                    fontFamily: "'DM Mono', monospace", fontSize: 12,
                    background: 'var(--cinza-sup)', color: 'var(--preto)', outline: 'none',
                  }}
                />
                <button
                  onClick={copiar}
                  style={{
                    background: 'none', border: '1px solid var(--cinza-borda)',
                    borderRadius: 8, padding: '9px 16px',
                    fontFamily: "'DM Sans', sans-serif", fontSize: 13,
                    color: copiado ? '#39BD3D' : 'var(--cinza-texto)', cursor: 'pointer',
                  }}
                >
                  {copiado ? 'Copiado' : 'Copiar'}
                </button>
              </>
            )}
          </div>
          {erro && <div style={{ color: '#FE7451', fontSize: 13, fontFamily: "'DM Sans', sans-serif", marginTop: 8 }}>{erro}</div>}
        </div>

        {/* Lista de organizações */}
        <div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: 1, color: 'var(--cinza-texto)', textTransform: 'uppercase', marginBottom: 12 }}>— Organizações</div>

          {isLoading ? (
            <div style={{ color: 'var(--cinza-texto)', fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>Carregando...</div>
          ) : (
            <div style={{ border: '1px solid var(--cinza-borda)', borderRadius: 10, overflow: 'hidden' }}>
              {orgs.length === 0 ? (
                <div style={{ padding: '20px', color: 'var(--cinza-texto)', fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>
                  Nenhuma organização ainda.
                </div>
              ) : orgs.map((org, i) => (
                <div key={org.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 20px',
                  borderBottom: i < orgs.length - 1 ? '1px solid var(--cinza-borda)' : 'none',
                }}>
                  <div>
                    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--preto)' }}>
                      {org.name}
                    </div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: 'var(--cinza-texto)', marginTop: 2 }}>
                      {org.memberCount} {org.memberCount === 1 ? 'membro' : 'membros'} · criado em {new Date(org.createdAt).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{
                      fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: 1,
                      textTransform: 'uppercase', padding: '3px 8px', borderRadius: 4,
                      background: org.plan === 'active' ? '#e8f9e8' : 'var(--cinza-sup)',
                      color: org.plan === 'active' ? '#39BD3D' : 'var(--cinza-texto)',
                    }}>
                      {PLAN_LABEL[org.plan] ?? org.plan}
                    </span>
                    <span style={{
                      fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: 1,
                      textTransform: 'uppercase', padding: '3px 8px', borderRadius: 4,
                      background: org.onboardingDone ? '#e8f9e8' : '#fff8e0',
                      color: org.onboardingDone ? '#39BD3D' : '#b8860b',
                    }}>
                      {org.onboardingDone ? 'Onboarding OK' : 'Pendente'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

const styles = {
  center: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100vh', background: 'var(--branco)',
  } as React.CSSProperties,
}
