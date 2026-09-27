import { useState, useEffect } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import logo from '../assets/logo-wordmark.svg'

const API_URL = import.meta.env.VITE_API_URL as string

type InviteInfo = {
  email: string
  role: string
  orgName: string
}

type Mode = 'loading' | 'invalid' | 'choose' | 'signup' | 'login' | 'accepting' | 'done'

export default function ConvitePage() {
  const { token } = useParams({ from: '/convite/$token' })
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('loading')
  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')

  useEffect(() => {
    fetch(`${API_URL}/api/invite/${token}`)
      .then(async (r) => {
        if (!r.ok) { setMode('invalid'); return }
        const data = await r.json() as InviteInfo
        setInvite(data)
        setMode('choose')
      })
      .catch(() => setMode('invalid'))
  }, [token])

  async function acceptInvite(accessToken: string) {
    setMode('accepting')
    const res = await fetch(`${API_URL}/api/invite/${token}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string }
      setErro(body.error ?? 'Erro ao aceitar convite')
      setMode('login')
      return
    }
    await supabase.auth.refreshSession()
    setMode('done')
    setTimeout(() => navigate({ to: '/biblioteca' }), 1500)
  }

  async function handleSignup() {
    setErro('')
    if (!nome.trim()) { setErro('Informe seu nome'); return }
    if (senha.length < 6) { setErro('A senha precisa ter ao menos 6 caracteres'); return }

    setCarregando(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { data: { full_name: nome.trim() } },
      })
      if (error) { setErro(error.message); return }
      if (!data.session) {
        setErro('Confirme seu email e volte para este link para continuar.')
        return
      }
      await acceptInvite(data.session.access_token)
    } finally {
      setCarregando(false)
    }
  }

  async function handleLogin() {
    setErro('')
    if (!senha) { setErro('Informe sua senha'); return }

    setCarregando(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (error) { setErro('Email ou senha incorretos'); return }
      await acceptInvite(data.session.access_token)
    } finally {
      setCarregando(false)
    }
  }

  if (mode === 'loading') {
    return (
      <div style={styles.center}>
        <div style={{ color: '#A0A0A0', fontFamily: "'DM Sans', sans-serif" }}>Verificando convite...</div>
      </div>
    )
  }

  if (mode === 'invalid') {
    return (
      <div style={styles.center}>
        <div style={{ textAlign: 'center' }}>
          <img src={logo} alt="docso" style={{ height: 22, marginBottom: 32 }} />
          <div style={styles.titulo}>Convite inválido ou já utilizado.</div>
          <div style={{ color: '#A0A0A0', fontFamily: "'DM Sans', sans-serif", fontSize: 14, marginTop: 8 }}>
            Peça ao administrador que envie um novo convite.
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'accepting') {
    return (
      <div style={styles.center}>
        <div style={{ color: '#A0A0A0', fontFamily: "'DM Sans', sans-serif" }}>Entrando na organização...</div>
      </div>
    )
  }

  if (mode === 'done') {
    return (
      <div style={styles.center}>
        <div style={{ color: '#39BD3D', fontFamily: "'DM Sans', sans-serif" }}>Pronto! Redirecionando...</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <img src={logo} alt="docso" style={{ height: 22, marginBottom: 40, display: 'block' }} />

        {mode === 'choose' && (
          <div>
            <div style={styles.titulo}>Você foi convidado para</div>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 28, letterSpacing: '-0.5px', color: '#30BCFE', lineHeight: 1.2, marginBottom: 24 }}>
              {invite?.orgName}
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: '#A0A0A0', marginBottom: 32 }}>
              Convite enviado para <strong style={{ color: '#FAFAFA' }}>{invite?.email}</strong>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button style={styles.btn} onClick={() => setMode('signup')}>
                Criar conta
              </button>
              <button
                style={{ ...styles.btn, background: 'transparent', border: '1px solid #2A2A2A', color: '#A0A0A0' }}
                onClick={() => setMode('login')}
              >
                Já tenho conta
              </button>
            </div>
          </div>
        )}

        {mode === 'signup' && (
          <div>
            <div style={styles.titulo}>Crie seu acesso</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: '#A0A0A0', marginBottom: 28 }}>
              {invite?.orgName}
            </div>

            <Campo label="Seu nome">
              <input style={styles.input} placeholder="Nome completo" value={nome} onChange={e => setNome(e.target.value)} />
            </Campo>
            <Campo label="Email">
              <input style={{ ...styles.input, color: '#666', cursor: 'not-allowed' }} value={invite?.email ?? ''} readOnly />
            </Campo>
            <Campo label="Senha">
              <input
                style={styles.input}
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSignup()}
              />
            </Campo>

            {erro && <div style={styles.erro}>{erro}</div>}

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button style={{ ...styles.btn, background: 'transparent', border: '1px solid #2A2A2A', color: '#A0A0A0' }} onClick={() => setMode('choose')}>
                Voltar
              </button>
              <button style={styles.btn} onClick={handleSignup} disabled={carregando}>
                {carregando ? 'Criando...' : 'Criar conta'}
              </button>
            </div>
          </div>
        )}

        {mode === 'login' && (
          <div>
            <div style={styles.titulo}>Entre na sua conta</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: '#A0A0A0', marginBottom: 28 }}>
              {invite?.orgName}
            </div>

            <Campo label="Email">
              <input
                style={styles.input}
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </Campo>
            <Campo label="Senha">
              <input
                style={styles.input}
                type="password"
                placeholder="Sua senha"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </Campo>

            {erro && <div style={styles.erro}>{erro}</div>}

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button style={{ ...styles.btn, background: 'transparent', border: '1px solid #2A2A2A', color: '#A0A0A0' }} onClick={() => setMode('choose')}>
                Voltar
              </button>
              <button style={styles.btn} onClick={handleLogin} disabled={carregando}>
                {carregando ? 'Entrando...' : 'Entrar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: '#A0A0A0', marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  )
}

const styles = {
  center: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: '#0A0A0A',
  } as React.CSSProperties,
  titulo: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontWeight: 700,
    fontSize: 24,
    letterSpacing: '-0.5px',
    color: '#FAFAFA',
    lineHeight: 1.2,
    marginBottom: 4,
  } as React.CSSProperties,
  input: {
    width: '100%',
    background: '#111',
    border: '1px solid #2A2A2A',
    borderRadius: 8,
    padding: '10px 14px',
    color: '#FAFAFA',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  } as React.CSSProperties,
  btn: {
    width: '100%',
    background: '#30BCFE',
    color: '#0A0A0A',
    border: 'none',
    borderRadius: 8,
    padding: '12px',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
  } as React.CSSProperties,
  erro: {
    color: '#FE7451',
    fontSize: 13,
    fontFamily: "'DM Sans', sans-serif",
    marginTop: 8,
  } as React.CSSProperties,
}
