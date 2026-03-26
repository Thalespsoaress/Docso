import { createRootRoute, createRoute, createRouter, Outlet, redirect } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'
import BibliotecaPage from './pages/BibliotecaPage'
import ProcessoPage from './pages/ProcessoPage'
import StudioPage from './pages/StudioPage'
import LoginPage from './pages/LoginPage'

function RootLayout() {
  return <Outlet />
}

const rootRoute = createRootRoute({ component: RootLayout })

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return null
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
  bibliotecaRoute,
  processoRoute,
  studioRoute,
  studioEditRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
