import { useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import monogramLight from '../assets/monogram-light.svg'
import './LoginPage.css'

export default function LoginPage() {
  const semAcesso = useMemo(() => new URLSearchParams(window.location.search).get('erro') === 'sem-acesso', [])
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [senhaVisivel, setSenhaVisivel] = useState(false)
  const [lembrar, setLembrar] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

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

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/biblioteca` },
    })
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
            <img src={monogramLight} alt="docso" style={{ height: 40, width: 'auto', display: 'block', marginBottom: 32 }} />

            <div className="form-titulo">Bom te ver<br />de volta.</div>

            <div className="campo">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                placeholder="seu@email.com.br"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEntrar()}
              />
            </div>

            <div className="campo">
              <label htmlFor="senha">Senha</label>
              <div className="senha-wrap">
                <input
                  type={senhaVisivel ? 'text' : 'password'}
                  id="senha"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleEntrar()}
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

            <div className="form-opcoes">
              <label className="checkbox-label" onClick={() => setLembrar(v => !v)}>
                <div className={`checkbox-custom${lembrar ? ' checked' : ''}`}>
                  {lembrar && <span className="checkbox-check" />}
                </div>
                <span className="checkbox-texto">Lembrar de mim</span>
              </label>
              <a href="#" className="esqueci">Esqueci a senha</a>
            </div>

            {semAcesso && !erro && (
              <div style={{ color: '#FE7451', fontSize: 13, marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>
                Sua conta não está vinculada a nenhuma organização. Entre em contato com o administrador.
              </div>
            )}

            {erro && (
              <div style={{ color: '#FE7451', fontSize: 13, marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>
                {erro}
              </div>
            )}

            <button className="btn-entrar" type="button" onClick={handleEntrar} disabled={carregando}>
              {carregando ? 'Aguarde...' : 'Entrar'}
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
