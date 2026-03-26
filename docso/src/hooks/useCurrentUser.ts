import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64)) as Record<string, unknown>
  } catch {
    return {}
  }
}

export function useCurrentUser() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  const user = session?.user
  const name =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    user?.email ??
    ''
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined

  const jwtClaims = session?.access_token ? decodeJwtPayload(session.access_token) : {}
  const appMetadata = jwtClaims['app_metadata'] as
    | { organization_id?: string; role?: string }
    | undefined
  const role = appMetadata?.role ?? ''
  const orgId = appMetadata?.organization_id ?? ''

  return {
    session,
    user,
    name,
    avatarUrl,
    role,
    orgId,
    isLoaded: session !== undefined,
    signOut: () => supabase.auth.signOut(),
  }
}
