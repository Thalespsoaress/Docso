import { useUser, useClerk, useOrganization } from '@clerk/clerk-react'
import { useNavigate, useRouterState } from '@tanstack/react-router'

const ROLE_LABEL: Record<string, string> = {
  admin:          'Admin',
  'org:admin':    'Admin',
  manager:        'Gerente',
  'org:manager':  'Gerente',
  member:         'Membro',
  'org:member':   'Membro',
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

export default function Sidebar({ onNavigate }: { onNavigate?: (action: () => void) => void }) {
  const { user } = useUser()
  const { signOut } = useClerk()
  const { membership } = useOrganization()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: s => s.location.pathname })

  function go(action: () => void) {
    if (onNavigate) onNavigate(action)
    else action()
  }

  const userInitials = user?.fullName ? initials(user.fullName) : '?'
  const roleLabel = membership?.role ? (ROLE_LABEL[membership.role] ?? membership.role) : 'Admin'
  const isHome = pathname === '/biblioteca' || pathname.startsWith('/processo/')
  const isStudio = pathname === '/studio'

  return (
    <aside className="sidebar">
      <a
        href="#"
        className="sidebar-logo"
        onClick={e => { e.preventDefault(); go(() => navigate({ to: '/biblioteca' })) }}
      >
        <span style={{
          fontFamily: "'Geist', -apple-system, sans-serif",
          fontWeight: 500,
          fontSize: 22,
          letterSpacing: '-0.06em',
          lineHeight: 1,
          color: '#FAFAFA',
          display: 'inline-flex',
          alignItems: 'baseline',
          userSelect: 'none',
        }}>
          docso
          <span style={{
            display: 'inline-block',
            width: '0.16em',
            height: '0.16em',
            borderRadius: '50%',
            background: '#30BCFE',
            marginLeft: '0.04em',
            position: 'relative',
            top: '-0.02em',
            flexShrink: 0,
          }} />
        </span>
      </a>

      <nav className="sidebar-nav">
        <a
          href="#"
          className={`nav-item${isHome ? ' active' : ''}`}
          onClick={e => { e.preventDefault(); go(() => navigate({ to: '/biblioteca' })) }}
        >
          <div className="nav-icon">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3.5h12M2 8h12M2 12.5h7"/>
            </svg>
          </div>
          Home
        </a>

        <a
          href="#"
          className={`nav-item${isStudio ? ' active' : ''}`}
          onClick={e => { e.preventDefault(); go(() => navigate({ to: '/studio' })) }}
        >
          <div className="nav-icon">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 8h12M8 2l6 6-6 6"/>
            </svg>
          </div>
          Studio
        </a>

        <a href="#" className="nav-item" onClick={e => e.preventDefault()}>
          <div className="nav-icon">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 13V8m4 5V5m4 8V3m4 10V6"/>
            </svg>
          </div>
          Analytics
        </a>
      </nav>

      <div className="sidebar-footer">
        <div className="user-chip" onClick={() => signOut()}>
          {user?.imageUrl ? (
            <img
              src={user.imageUrl}
              alt={user.fullName ?? ''}
              style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <div className="user-avatar">{userInitials}</div>
          )}
          <div className="user-info">
            <div className="user-name">{user?.fullName ?? user?.primaryEmailAddress?.emailAddress}</div>
            <div className="user-role">{roleLabel}</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
