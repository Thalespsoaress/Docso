import { jwtVerify, createRemoteJWKSet } from 'jose'
import { createMiddleware } from 'hono/factory'

type AuthVariables = {
  userId: string
  organizationId: string
  role: string
}

let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null

function getJWKS() {
  if (!_jwks) {
    const url = process.env.SUPABASE_URL
    if (!url) throw new Error('SUPABASE_URL não configurada')
    _jwks = createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`))
  }
  return _jwks
}

export async function verifyJWT(token: string) {
  const { payload } = await jwtVerify(token, getJWKS())
  return payload
}

export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Token não fornecido', code: 'UNAUTHORIZED' }, 401)
    }

    try {
      const payload = await verifyJWT(authHeader.slice(7))
      const userId = payload.sub
      const meta = payload['app_metadata'] as { organization_id?: string; role?: string } | undefined
      const organizationId = meta?.organization_id
      const role = meta?.role

      if (!userId || !organizationId || !role) {
        return c.json(
          { error: 'Usuário não pertence a nenhuma organização', code: 'NO_ORGANIZATION' },
          403
        )
      }

      c.set('userId', userId)
      c.set('organizationId', organizationId)
      c.set('role', role)
      await next()
    } catch {
      return c.json({ error: 'Token inválido', code: 'INVALID_TOKEN' }, 401)
    }
  }
)
