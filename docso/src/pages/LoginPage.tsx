import { useState } from 'react'
import { supabase } from '../lib/supabase'
import logo from '../assets/logo-wordmark.svg'
import './LoginPage.css'

const API_URL = import.meta.env.VITE_API_URL as string

export default function LoginPage() {
  const [modo, setModo] = useState<'entrar' | 'cadastrar'>('entrar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState('')
  const [nomeOrg, setNomeOrg] = useState('')
  const [senhaVisivel, setSenhaVisivel] = useState(false)
  const [lembrar, setLembrar] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [emailConfirmacao, setEmailConfirmacao] = useState(false)

  async function handleEntrar() {
    setErro('')
    setCarregando(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (error) {
        setErro('Email ou senha incorretos')
        return
      }
      window.location.href = '/biblioteca'
    } finally {
      setCarregando(false)
    }
  }

  async function handleCadastrar() {
    setErro('')
    if (!nome.trim()) { setErro('Informe seu nome'); return }
    if (!nomeOrg.trim()) { setErro('Informe o nome da sua empresa'); return }
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
        setEmailConfirmacao(true)
        return
      }

      const res = await fetch(`${API_URL}/api/auth/setup-organization`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({ name: nomeOrg.trim() }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        setErro(body.error ?? 'Erro ao criar organização')
        return
      }

      await supabase.auth.refreshSession()
      window.location.href = '/biblioteca'
    } finally {
      setCarregando(false)
    }
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/biblioteca` },
    })
  }

  function handleSubmit() {
    if (modo === 'entrar') handleEntrar()
    else handleCadastrar()
  }

  if (emailConfirmacao) {
    return (
      <div className="login-root">
        <svg viewBox="0 0 1200 900" preserveAspectRatio="xMidYMid slice" className="login-bg-svg" aria-hidden="true">
          <path className="metro-train" style={{ animationDuration: '6s', animationDelay: '0s' }} d="M 220 -30 L 220 430 L 1300 430" fill="none" stroke="#30BCFE" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="login-bg-gradient" />
        <div className="login-layout">
          <div className="login-card-col">
            <div className="right-inner">
              <img src={logo} alt="docso" style={{ height: 22, width: 'auto', display: 'block', marginBottom: 32 }} />
              <div className="form-titulo">Confirme<br />seu email.</div>
              <div className="form-sub" style={{ marginTop: 16 }}>
                Enviamos um link para <strong>{email}</strong>.<br />
                Clique no link para ativar sua conta.
              </div>
              <button className="btn-entrar" style={{ marginTop: 32 }} onClick={() => setEmailConfirmacao(false)}>
                Voltar ao login
              </button>
            </div>
          </div>
          <div className="login-headline-col">
            <div className="left-middle">
              <div className="left-headline">Seu<br />processo<span style={{ color: '#30BCFE', fontFamily: "'DM Sans', sans-serif" }}>.</span><br />No lugar<br />certo<span style={{ color: '#39BD3D', fontFamily: "'DM Sans', sans-serif" }}>.</span></div>
              <div className="left-sub">Documente como seu time trabalha, treine quem é novo e retenha conhecimento.</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="login-root">

      <svg
        viewBox="0 0 1200 900"
        preserveAspectRatio="xMidYMid slice"
        className="login-bg-svg"
        aria-hidden="true"
      >
        <path className="metro-train" style={{ animationDuration: '6s',   animationDelay: '0s' }}    d="M 220 -30 L 220 430 L 1300 430"   fill="none" stroke="#30BCFE" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
        <path className="metro-train" style={{ animationDuration: '6.8s', animationDelay: '-2.8s' }} d="M 240 -30 L 240 455 L 1300 455"   fill="none" stroke="#39BD3D"  strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
        <path className="metro-train" style={{ animationDuration: '7.5s', animationDelay: '-1.2s' }} d="M 580 -30 L 580 300 L 1300 300"   fill="none" stroke="#30BCFE" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
        <path className="metro-train" style={{ animationDuration: '8s',   animationDelay: '-5.1s' }} d="M 600 -30 L 600 325 L 1300 325"   fill="none" stroke="#FADB02" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
        <path className="metro-train" style={{ animationDuration: '5.6s', animationDelay: '-1.4s' }} d="M 920 -30 L 920 520 L -30 520"    fill="none" stroke="#FE7451" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
        <path className="metro-train" style={{ animationDuration: '7.2s', animationDelay: '-4.5s' }} d="M 945 -30 L 945 548 L -30 548"    fill="none" stroke="#FADB02" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
        <path className="metro-train" style={{ animationDuration: '6.4s', animationDelay: '-3.7s' }} d="M 700 -30 L 700 660 L -30 660"    fill="none" stroke="#39BD3D"  strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
        <path className="metro-train" style={{ animationDuration: '5.2s', animationDelay: '-0.6s' }} d="M 720 -30 L 720 685 L -30 685"    fill="none" stroke="#FE7451" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
        <path className="metro-train" style={{ animationDuration: '5s',   animationDelay: '-0.9s' }} d="M 220 430 L 220 960"               fill="none" stroke="#30BCFE" strokeWidth="22" strokeLinecap="round" />
        <path className="metro-train" style={{ animationDuration: '6.2s', animationDelay: '-3.3s' }} d="M 240 455 L 240 960"               fill="none" stroke="#39BD3D"  strokeWidth="22" strokeLinecap="round" />
        <path className="metro-train" style={{ animationDuration: '7s',   animationDelay: '-2.1s' }} d="M 580 300 L 580 960"               fill="none" stroke="#30BCFE" strokeWidth="22" strokeLinecap="round" />
        <path className="metro-train" style={{ animationDuration: '5.8s', animationDelay: '-4.0s' }} d="M 600 325 L 600 960"               fill="none" stroke="#FADB02" strokeWidth="22" strokeLinecap="round" />
        <path className="metro-train" style={{ animationDuration: '6.6s', animationDelay: '-1.9s' }} d="M -30 180 L 400 180 L 400 960"    fill="none" stroke="#FE7451" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
        <path className="metro-train" style={{ animationDuration: '7.8s', animationDelay: '-5.5s' }} d="M -30 200 L 420 200 L 420 960"    fill="none" stroke="#FADB02" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      <div className="login-bg-gradient" />

      <div className="login-layout">

        <div className="login-card-col">
          <div className="right-inner">
            <img src={logo} alt="docso" style={{ height: 22, width: 'auto', display: 'block', marginBottom: 32 }} />

            <div className="form-titulo">
              {modo === 'entrar' ? <>Bom te ver<br />de volta.</> : <>Crie sua<br />conta.</>}
            </div>
            <div className="form-sub">
              {modo === 'entrar'
                ? <><a href="#" onClick={e => { e.preventDefault(); setModo('cadastrar'); setErro('') }}>Criar conta</a></>
                : <>Já tem conta? <a href="#" onClick={e => { e.preventDefault(); setModo('entrar'); setErro('') }}>Entrar</a></>
              }
            </div>

            {modo === 'cadastrar' && (
              <div className="campo">
                <label htmlFor="nome">Nome completo</label>
                <input
                  type="text"
                  id="nome"
                  placeholder="Seu nome"
                  autoComplete="name"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />
              </div>
            )}

            <div className="campo">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                placeholder="seu@email.com.br"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>

            <div className="campo">
              <label htmlFor="senha">Senha</label>
              <div className="senha-wrap">
                <input
                  type={senhaVisivel ? 'text' : 'password'}
                  id="senha"
                  placeholder="••••••••"
                  autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />
                <button
                  className="senha-toggle"
                  onClick={() => setSenhaVisivel(v => !v)}
                  type="button"
                >
                  {senhaVisivel ? 'Ocultar' : 'Ver'}
                </button>
              </div>
            </div>

            {modo === 'cadastrar' && (
              <div className="campo">
                <label htmlFor="nomeOrg">Nome da empresa</label>
                <input
                  type="text"
                  id="nomeOrg"
                  placeholder="Acme Ltda"
                  value={nomeOrg}
                  onChange={e => setNomeOrg(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />
              </div>
            )}

            {modo === 'entrar' && (
              <div className="form-opcoes">
                <label className="checkbox-label" onClick={() => setLembrar(v => !v)}>
                  <div className={`checkbox-custom${lembrar ? ' checked' : ''}`}>
                    {lembrar && <span className="checkbox-check" />}
                  </div>
                  <span className="checkbox-texto">Lembrar de mim</span>
                </label>
                <a href="#" className="esqueci">Esqueci a senha</a>
              </div>
            )}

            {erro && (
              <div style={{ color: '#FE7451', fontSize: 13, marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>
                {erro}
              </div>
            )}

            <button className="btn-entrar" type="button" onClick={handleSubmit} disabled={carregando}>
              {carregando ? 'Aguarde...' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
            </button>

            <div className="divisor">
              <div className="divisor-linha" />
              <div className="divisor-texto">ou</div>
              <div className="divisor-linha" />
            </div>

            <button className="btn-sso" type="button" onClick={handleGoogle} disabled={carregando}>
              <div className="sso-icon">
                <div className="sso-dot" style={{ background: '#4285F4' }} />
                <div className="sso-dot" style={{ background: '#EA4335' }} />
                <div className="sso-dot" style={{ background: '#34A853' }} />
                <div className="sso-dot" style={{ background: '#FBBC05' }} />
              </div>
              Continuar com Google
            </button>
          </div>
        </div>

        <div className="login-headline-col">
          <div className="left-middle">
            <div className="left-headline">
              Seu<br />processo<span style={{ color: '#30BCFE', fontFamily: "'DM Sans', sans-serif" }}>.</span><br />No lugar<br />certo<span style={{ color: '#39BD3D', fontFamily: "'DM Sans', sans-serif" }}>.</span>
            </div>
            <div className="left-sub">
              Documente como seu time trabalha, treine quem é novo e retenha conhecimento.
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
