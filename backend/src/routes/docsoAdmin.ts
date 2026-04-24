import { Hono } from 'hono'
import { randomBytes } from 'crypto'
import { verifyJWT } from '../middleware/auth.js'
import prisma from '../lib/prisma.js'

const FRONTEND_URL = process.env['FRONTEND_URL'] ?? 'https://app.docso.app'

function getAdminEmails(): string[] {
  return (process.env['DOCSO_ADMIN_EMAILS'] ?? '').split(',').map(e => e.trim()).filter(Boolean)
}

const docsoAdmin = new Hono()

docsoAdmin.use('*', async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Token não fornecido', code: 'UNAUTHORIZED' }, 401)
  }
  try {
    const payload = await verifyJWT(authHeader.slice(7))
    const email = payload.email as string | undefined
if (!email || !getAdminEmails().includes(email)) {
      return c.json({ error: 'Acesso negado', code: 'FORBIDDEN' }, 403)
    }
    await next()
  } catch {
    return c.json({ error: 'Token inválido', code: 'INVALID_TOKEN' }, 401)
  }
})

// Lista todas as organizações
docsoAdmin.get('/orgs', async (c) => {
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { members: true } },
      onboarding: { select: { completedAt: true } },
    },
  })

  return c.json(orgs.map(o => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    plan: o.plan,
    createdAt: o.createdAt,
    memberCount: o._count.members,
    onboardingDone: !!o.onboarding?.completedAt,
  })))
})

// Gera token de onboarding para um novo cliente
docsoAdmin.post('/onboarding-token', async (c) => {
  const body = await c.req.json<{ email: string }>()
  if (!body.email?.trim()) {
    return c.json({ error: 'Email obrigatório', code: 'VALIDATION_ERROR' }, 400)
  }

  const token = randomBytes(24).toString('hex')
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 horas
  await prisma.onboardingToken.create({
    data: { token, email: body.email.trim().toLowerCase(), expiresAt },
  })

  const link = `${FRONTEND_URL}/setup/${token}`
  return c.json({ token, link }, 201)
})

export default docsoAdmin
