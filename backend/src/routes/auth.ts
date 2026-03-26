import { Hono } from 'hono'
import { verifyJWT } from '../middleware/auth.js'
import prisma from '../lib/prisma.js'

const auth = new Hono()

// Chamado pelo frontend após signup para criar a organização.
// Usa verifyJWT direto pois o JWT recém-criado ainda não tem org claims.
auth.post('/api/auth/setup-organization', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Token não fornecido', code: 'UNAUTHORIZED' }, 401)
  }

  let userId: string
  try {
    const payload = await verifyJWT(authHeader.slice(7))
    if (!payload.sub) throw new Error('sub ausente')
    userId = payload.sub
  } catch {
    return c.json({ error: 'Token inválido', code: 'INVALID_TOKEN' }, 401)
  }

  const body = await c.req.json<{ name: string }>()
  if (!body.name?.trim()) {
    return c.json({ error: 'Nome da organização é obrigatório', code: 'VALIDATION_ERROR' }, 400)
  }

  const existing = await prisma.organizationMember.findFirst({ where: { userId } })
  if (existing) {
    return c.json({ error: 'Usuário já pertence a uma organização', code: 'ALREADY_SETUP' }, 409)
  }

  const slug =
    body.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') +
    '-' +
    Date.now()

  const org = await prisma.organization.create({
    data: {
      name: body.name.trim(),
      slug,
      members: {
        create: { userId, role: 'admin' },
      },
    },
  })

  return c.json({ organizationId: org.id }, 201)
})

export default auth
