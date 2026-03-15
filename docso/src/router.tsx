import { createRootRoute, createRoute, createRouter, Outlet, redirect } from '@tanstack/react-router'
import { useAuth } from '@clerk/clerk-react'
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
  const { isSignedIn, isLoaded } = useAuth()
  if (!isLoaded) return null
  if (!isSignedIn) {
    router.navigate({ to: '/login', replace: true })
    return null
  }
  return <>{children}</>
}

const bibliotecaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/biblioteca',
  component: () => <ProtectedRoute><BibliotecaPage /></ProtectedRoute>,
})

const processoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/processo/$id',
  component: () => <ProtectedRoute><ProcessoPage /></ProtectedRoute>,
})

const studioRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/studio',
  component: () => <ProtectedRoute><StudioPage /></ProtectedRoute>,
})

const studioEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/studio/$id',
  component: () => <ProtectedRoute><StudioPage /></ProtectedRoute>,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => { throw redirect({ to: '/biblioteca' }) },
  component: () => null,
})

const routeTree = rootRoute.addChildren([indexRoute, loginRoute, bibliotecaRoute, processoRoute, studioRoute, studioEditRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
