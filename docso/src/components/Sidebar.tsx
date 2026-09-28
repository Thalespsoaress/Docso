import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useCurrentUser } from '../hooks/useCurrentUser'
import logoBranco from '../assets/logo-branco.svg'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  manager: 'Gerente',
  member: 'Membro',
}

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export default function Sidebar({ onNavigate }: { onNavigate?: (action: () => void) => void }) {
  const { name, avatarUrl, role, signOut } = useCurrentUser()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  function go(action: () => void) {
    if (onNavigate) onNavigate(action)
    else action()
  }

  async function handleSignOut() {
    await signOut()
    window.location.href = '/login'
  }

  const userInitials = name ? initials(name) : '?'
  const roleLabel = ROLE_LABEL[role] ?? 'Admin'
  const isHome = pathname === '/biblioteca' || pathname.startsWith('/processo/')
  const isStudio = pathname === '/studio' || pathname.startsWith('/studio/')
  const isMembros = pathname === '/membros'
  const canAccessStudio = role === 'admin' || role === 'manager'

  return (
    <aside className="sidebar">
      <a
        href="#"
        className="sidebar-logo"
        onClick={(e) => {
          e.preventDefault()
          go(() => navigate({ to: '/biblioteca' }))
        }}
      >
        <img src={logoBranco} alt="docso" style={{ height: 20, width: 'auto', display: 'block' }} />
      </a>

      <nav className="sidebar-nav">
        <a
          href="#"
          className={`nav-item${isHome ? ' active' : ''}`}
          onClick={(e) => {
            e.preventDefault()
            go(() => navigate({ to: '/biblioteca' }))
          }}
        >
          <div className="nav-icon">
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 3.5h12M2 8h12M2 12.5h7" />
            </svg>
          </div>
          Home
        </a>

        {canAccessStudio && (
          <a
            href="#"
            className={`nav-item${isStudio ? ' active' : ''}`}
            onClick={(e) => {
              e.preventDefault()
              go(() => navigate({ to: '/studio' }))
            }}
          >
            <div className="nav-icon">
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 8h12M8 2l6 6-6 6" />
              </svg>
            </div>
            Studio
          </a>
        )}

        {role === 'admin' && (
          <a
            href="#"
            className={`nav-item${isMembros ? ' active' : ''}`}
            onClick={(e) => {
              e.preventDefault()
              go(() => navigate({ to: '/membros' }))
            }}
          >
            <div className="nav-icon">
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="6" cy="5" r="2.5" />
                <path d="M1 13c0-2.76 2.24-4 5-4s5 1.24 5 4" />
                <path d="M11 7c1.1 0 2 .9 2 2M13 7c1.1 0 2 .9 2 2v1.5" />
              </svg>
            </div>
            Equipe
          </a>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="user-chip" onClick={handleSignOut}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                objectFit: 'cover',
                flexShrink: 0,
              }}
            />
          ) : (
            <div className="user-avatar">{userInitials}</div>
          )}
          <div className="user-info">
            <div className="user-name">{name}</div>
            <div className="user-role">{roleLabel}</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
