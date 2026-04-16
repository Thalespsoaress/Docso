import { createRootRoute, createRoute, createRouter, Outlet, redirect } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { supabase } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'
import BibliotecaPage from './pages/BibliotecaPage'
import ProcessoPage from './pages/ProcessoPage'
import StudioPage from './pages/StudioPage'
import LoginPage from './pages/LoginPage'
import OnboardingPage from './pages/OnboardingPage'
import MembrosPage from './pages/MembrosPage'
import ConvitePage from './pages/ConvitePage'

function RootLayout() {
  return <Outlet />
}

const rootRoute = createRootRoute({ component: RootLayout })

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64)) as Record<string, unknown>
  } catch {
    return {}
  }
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [settingUpOrg, setSettingUpOrg] = useState(false)
  const setupAttempted = useRef(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session || settingUpOrg || setupAttempted.current) return

    const claims = decodeJwtPayload(session.access_token)
    const appMeta = claims['app_metadata'] as { organization_id?: string } | undefined
    if (appMeta?.organization_id) return

    const pendingOrg = localStorage.getItem('docso_pending_org')
    if (!pendingOrg) {
      router.navigate({ to: '/login', replace: true })
      return
    }

    setupAttempted.current = true
    setSettingUpOrg(true)
    const apiUrl = import.meta.env.VITE_API_URL as string
    fetch(`${apiUrl}/api/auth/setup-organization`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ name: pendingOrg }),
    })
      .then(async (res) => {
        if (res.ok || res.status === 409) {
          localStorage.removeItem('docso_pending_org')
          await supabase.auth.refreshSession()
        }
      })
      .finally(() => setSettingUpOrg(false))
  }, [session, settingUpOrg])

  if (session === undefined || settingUpOrg) return null
  if (!session) {
    router.navigate({ to: '/login', replace: true })
    return null
  }
  return <>{children}</>
}

const bibliotecaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/biblioteca',
  component: () => (
    <ProtectedRoute>
      <BibliotecaPage />
    </ProtectedRoute>
  ),
})

const processoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/processo/$id',
  component: () => (
    <ProtectedRoute>
      <ProcessoPage />
    </ProtectedRoute>
  ),
})

const studioRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/studio',
  component: () => (
    <ProtectedRoute>
      <StudioPage />
    </ProtectedRoute>
  ),
})

const studioEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/studio/$id',
  component: () => (
    <ProtectedRoute>
      <StudioPage />
    </ProtectedRoute>
  ),
})

const membrosRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/membros',
  component: () => (
    <ProtectedRoute>
      <MembrosPage />
    </ProtectedRoute>
  ),
})

const conviteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/convite/$token',
  component: ConvitePage,
})

const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/setup/$token',
  component: OnboardingPage,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/biblioteca' })
  },
  component: () => null,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  setupRoute,
  conviteRoute,
  bibliotecaRoute,
  processoRoute,
  studioRoute,
  studioEditRoute,
  membrosRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
