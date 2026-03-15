import { verifyToken } from '@clerk/backend'
import { createMiddleware } from 'hono/factory'
import prisma from '../lib/prisma.js'

type AuthVariables = {
  userId: string
  organizationId: string
  role: string
}

export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Token não fornecido', code: 'UNAUTHORIZED' }, 401)
    }

    const token = authHeader.slice(7)

    try {
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      })
      const userId = payload.sub

      const member = await prisma.organizationMember.findFirst({
        where: { userId },
      })

      if (!member) {
        return c.json(
          { error: 'Usuário não pertence a nenhuma organização', code: 'NO_ORGANIZATION' },
          403
        )
      }

      c.set('userId', userId)
      c.set('organizationId', member.organizationId)
      c.set('role', member.role)
      await next()
    } catch {
      return c.json({ error: 'Token inválido', code: 'INVALID_TOKEN' }, 401)
    }
  }
)
