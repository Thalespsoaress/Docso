import { useState, useEffect } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import logo from '../assets/logo-wordmark.svg'

const API_URL = import.meta.env.VITE_API_URL as string

const SEGMENTS = [
  'Agência de marketing',
  'Consultoria',
  'Escritório contábil',
  'Escritório jurídico',
  'Tecnologia',
  'Saúde',
  'Educação',
  'Varejo',
  'Outro',
]

const EMPLOYEE_RANGES = ['1–10', '11–30', '31–50', '51–100', '100+']

const DOCUMENTATION_OPTIONS = [
  'Não documentamos',
  'Word / Google Docs',
  'Notion',
  'Planilhas',
  'Outro',
]

const REFERRAL_OPTIONS = [
  'Indicação de alguém',
  'LinkedIn',
  'Google',
  'Instagram',
  'Outro',
]

type Step = 1 | 2 | 3

export default function OnboardingPage() {
  const { token } = useParams({ from: '/setup/$token' })
  const navigate = useNavigate()

  const [tokenValido, setTokenValido] = useState<boolean | null>(null)
  const [step, setStep] = useState<Step>(1)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  // Etapa 1 — Empresa
  const [name, setName] = useState('')
  const [fantasyName, setFantasyName] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [segment, setSegment] = useState('')
  const [employeeCount, setEmployeeCount] = useState('')

  // Etapa 2 — Contexto
  const [documentationToday, setDocumentationToday] = useState('')
  const [mainProblem, setMainProblem] = useState('')
  const [referralSource, setReferralSource] = useState('')

  // Etapa 3 — Conta
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState('')

  useEffect(() => {
    fetch(`${API_URL}/api/onboarding/${token}`)
      .then(r => {
        if (r.ok) setTokenValido(true)
        else setTokenValido(false)
      })
      .catch(() => setTokenValido(false))
  }, [token])

  async function handleConcluir() {
    setErro('')
    if (!nome.trim()) { setErro('Informe seu nome'); return }
    if (!email.trim()) { setErro('Informe seu email'); return }
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

      const res = await fetch(`${API_URL}/api/onboarding/${token}/setup-org`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          fantasyName: fantasyName.trim() || undefined,
          cnpj: cnpj.replace(/\D/g, '') || undefined,
          segment: segment || undefined,
          employeeCountAtSignup: employeeCount || undefined,
          documentationToday: documentationToday || undefined,
          mainProblem: mainProblem.trim() || undefined,
          referralSource: referralSource || undefined,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        setErro(body.error ?? 'Erro ao configurar organização')
        return
      }

      await supabase.auth.refreshSession()
      navigate({ to: '/biblioteca' })
    } finally {
      setCarregando(false)
    }
  }

  if (tokenValido === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0A0A0A' }}>
        <div style={{ color: '#A0A0A0', fontFamily: "'DM Sans', sans-serif" }}>Verificando...</div>
      </div>
    )
  }

  if (tokenValido === false) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0A0A0A' }}>
        <div style={{ textAlign: 'center' }}>
          <img src={logo} alt="docso" style={{ height: 22, marginBottom: 32 }} />
          <div style={{ color: '#FAFAFA', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 20 }}>Link inválido ou já utilizado.</div>
          <div style={{ color: '#A0A0A0', fontFamily: "'DM Sans', sans-serif", fontSize: 14, marginTop: 8 }}>Entre em contato com a Docso para obter um novo link.</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <img src={logo} alt="docso" style={{ height: 22, marginBottom: 40, display: 'block' }} />

        {/* Indicador de etapa */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 40 }}>
          {([1, 2, 3] as Step[]).map(s => (
            <div key={s} style={{ height: 3, flex: 1, borderRadius: 99, background: s <= step ? '#30BCFE' : '#1A1A1A' }} />
          ))}
        </div>

        {step === 1 && (
          <div>
            <div style={styles.titulo}>Conta sobre<br />sua empresa.</div>
            <div style={styles.sub}>Etapa 1 de 3</div>

            <Campo label="Razão social">
              <input style={styles.input} placeholder="Empresa S.A." value={name} onChange={e => setName(e.target.value)} />
            </Campo>

            <Campo label="Nome fantasia">
              <input style={styles.input} placeholder="Como é conhecida" value={fantasyName} onChange={e => setFantasyName(e.target.value)} />
            </Campo>

            <Campo label="CNPJ">
              <input style={styles.input} placeholder="00.000.000/0001-00" value={cnpj} onChange={e => setCnpj(e.target.value)} />
            </Campo>

            <Campo label="Segmento">
              <select style={styles.select} value={segment} onChange={e => setSegment(e.target.value)}>
                <option value="">Selecione</option>
                {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Campo>

            <Campo label="Número de colaboradores ao iniciar com a Docso">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {EMPLOYEE_RANGES.map(r => (
                  <button key={r} type="button" style={{ ...styles.pill, ...(employeeCount === r ? styles.pillActive : {}) }} onClick={() => setEmployeeCount(r)}>
                    {r}
                  </button>
                ))}
              </div>
            </Campo>

            <button style={styles.btn} onClick={() => { if (!name.trim()) { setErro('Informe a razão social'); return }; setErro(''); setStep(2) }}>
              Continuar
            </button>
            {erro && <div style={styles.erro}>{erro}</div>}
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={styles.titulo}>Como vocês<br />trabalham hoje?</div>
            <div style={styles.sub}>Etapa 2 de 3</div>

            <Campo label="Como documentam processos hoje?">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {DOCUMENTATION_OPTIONS.map(o => (
                  <button key={o} type="button" style={{ ...styles.pill, ...(documentationToday === o ? styles.pillActive : {}) }} onClick={() => setDocumentationToday(o)}>
                    {o}
                  </button>
                ))}
              </div>
            </Campo>

            <Campo label="Qual é o principal problema que quer resolver?">
              <textarea style={{ ...styles.input, height: 100, resize: 'none' }} placeholder="Descreva brevemente..." value={mainProblem} onChange={e => setMainProblem(e.target.value)} />
            </Campo>

            <Campo label="Como ficou sabendo da Docso?">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {REFERRAL_OPTIONS.map(o => (
                  <button key={o} type="button" style={{ ...styles.pill, ...(referralSource === o ? styles.pillActive : {}) }} onClick={() => setReferralSource(o)}>
                    {o}
                  </button>
                ))}
              </div>
            </Campo>

            <div style={{ display: 'flex', gap: 12 }}>
              <button style={{ ...styles.btn, background: 'transparent', border: '1px solid #2A2A2A', color: '#A0A0A0' }} onClick={() => setStep(1)}>
                Voltar
              </button>
              <button style={styles.btn} onClick={() => { setErro(''); setStep(3) }}>
                Continuar
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div style={styles.titulo}>Crie seu<br />acesso.</div>
            <div style={styles.sub}>Etapa 3 de 3</div>

            <Campo label="Seu nome">
              <input style={styles.input} placeholder="Nome completo" value={nome} onChange={e => setNome(e.target.value)} />
            </Campo>

            <Campo label="Email">
              <input style={styles.input} type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} />
            </Campo>

            <Campo label="Senha">
              <input style={styles.input} type="password" placeholder="Mínimo 6 caracteres" value={senha} onChange={e => setSenha(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleConcluir()} />
            </Campo>

            {erro && <div style={styles.erro}>{erro}</div>}

            <div style={{ display: 'flex', gap: 12 }}>
              <button style={{ ...styles.btn, background: 'transparent', border: '1px solid #2A2A2A', color: '#A0A0A0' }} onClick={() => setStep(2)}>
                Voltar
              </button>
              <button style={styles.btn} onClick={handleConcluir} disabled={carregando}>
                {carregando ? 'Criando...' : 'Concluir'}
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
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: '#A0A0A0', marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  )
}

const styles = {
  titulo: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontWeight: 700,
    fontSize: 28,
    letterSpacing: '-0.5px',
    color: '#FAFAFA',
    lineHeight: 1.2,
    marginBottom: 6,
  } as React.CSSProperties,
  sub: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 13,
    color: '#A0A0A0',
    marginBottom: 32,
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
  select: {
    width: '100%',
    background: '#111',
    border: '1px solid #2A2A2A',
    borderRadius: 8,
    padding: '10px 14px',
    color: '#FAFAFA',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 14,
    outline: 'none',
  } as React.CSSProperties,
  pill: {
    background: '#111',
    border: '1px solid #2A2A2A',
    borderRadius: 99,
    padding: '6px 14px',
    color: '#A0A0A0',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 13,
    cursor: 'pointer',
  } as React.CSSProperties,
  pillActive: {
    background: '#0e2a38',
    border: '1px solid #30BCFE',
    color: '#30BCFE',
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
    marginTop: 8,
  } as React.CSSProperties,
  erro: {
    color: '#FE7451',
    fontSize: 13,
    fontFamily: "'DM Sans', sans-serif",
    marginTop: 8,
  } as React.CSSProperties,
}
