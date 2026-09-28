import { createRootRoute, createRoute, createRouter, Outlet, redirect } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'
import BibliotecaPage from './pages/BibliotecaPage'
import ProcessoPage from './pages/ProcessoPage'
import StudioPage from './pages/StudioPage'
import StudioLandingPage from './pages/StudioLandingPage'
import LoginPage from './pages/LoginPage'
import OnboardingPage from './pages/OnboardingPage'
import MembrosPage from './pages/MembrosPage'
import ConvitePage from './pages/ConvitePage'
import DocsoAdminPage from './pages/DocsoAdminPage'
import TreinamentoPage from './pages/TreinamentoPage'
import MapeamentoPage from './pages/MapeamentoPage'
import BrandLoader from './components/BrandLoader'

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

// Inicia a busca da sessão imediatamente ao importar o módulo,
// antes de qualquer render do React.
const initialSessionPromise = supabase.auth.getSession()

function ProtectedRoute({ children }: { children: React.ReactNode }) {

  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    initialSessionPromise.then(({ data }) => setSession(data.session))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session === undefined) return
    if (!session) { router.navigate({ to: '/login', replace: true }); return }

    const claims = decodeJwtPayload(session.access_token)
    const appMeta = claims['app_metadata'] as { organization_id?: string } | undefined
    if (!appMeta?.organization_id) {
      router.navigate({ to: '/login', search: { erro: 'sem-acesso' }, replace: true })
    }
  }, [session])

  if (session === undefined) return <BrandLoader />
  return <>{children}</>
}

function AdminManagerRoute({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    initialSessionPromise.then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session === undefined) return
    if (!session) { router.navigate({ to: '/login', replace: true }); return }

    const claims = decodeJwtPayload(session.access_token)
    const appMeta = claims['app_metadata'] as { organization_id?: string; role?: string } | undefined
    if (!appMeta?.organization_id) {
      router.navigate({ to: '/login', search: { erro: 'sem-acesso' }, replace: true })
      return
    }
    if (appMeta.role !== 'admin' && appMeta.role !== 'manager') {
      router.navigate({ to: '/biblioteca', replace: true })
    }
  }, [session])

  if (session === undefined) return <BrandLoader />
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
    <AdminManagerRoute>
      <StudioLandingPage />
    </AdminManagerRoute>
  ),
})

const studioNovoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/studio/novo',
  component: () => (
    <AdminManagerRoute>
      <StudioPage />
    </AdminManagerRoute>
  ),
})

const studioEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/studio/$id',
  component: () => (
    <AdminManagerRoute>
      <StudioPage />
    </AdminManagerRoute>
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

const docsoAdminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/docso-admin',
  component: () => (
    <ProtectedRoute>
      <DocsoAdminPage />
    </ProtectedRoute>
  ),
})

const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/setup/$token',
  component: OnboardingPage,
})

const treinamentoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/treinamento/$token',
  component: TreinamentoPage,
})

const mapeamentoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mapeamento',
  component: () => (
    <AdminManagerRoute>
      <MapeamentoPage />
    </AdminManagerRoute>
  ),
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
  treinamentoRoute,
  mapeamentoRoute,
  bibliotecaRoute,
  processoRoute,
  studioRoute,
  studioNovoRoute,
  studioEditRoute,
  membrosRoute,
  docsoAdminRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
