import { Hono } from 'hono'
import { randomBytes } from 'crypto'
import { verifyJWT } from '../middleware/auth.js'
import prisma from '../lib/prisma.js'

const onboarding = new Hono()

// Gera um token de onboarding (uso interno — superadmin chama isso)
onboarding.post('/api/onboarding/tokens', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Token não fornecido', code: 'UNAUTHORIZED' }, 401)
  }
  try {
    await verifyJWT(authHeader.slice(7))
  } catch {
    return c.json({ error: 'Token inválido', code: 'INVALID_TOKEN' }, 401)
  }

  const token = randomBytes(24).toString('hex')
  await prisma.onboardingToken.create({ data: { token } })

  return c.json({ token }, 201)
})

// Valida token (chamado pelo frontend ao carregar a página /setup/:token)
onboarding.get('/api/onboarding/:token', async (c) => {
  const { token } = c.req.param()
  const record = await prisma.onboardingToken.findUnique({ where: { token } })

  if (!record) return c.json({ error: 'Token inválido', code: 'INVALID_TOKEN' }, 404)
  if (record.usedAt) return c.json({ error: 'Token já utilizado', code: 'TOKEN_USED' }, 410)

  return c.json({ valid: true })
})

// Completa o onboarding — etapa 1 e 2 (empresa + contexto)
onboarding.post('/api/onboarding/:token/setup-org', async (c) => {
  const { token } = c.req.param()
  const record = await prisma.onboardingToken.findUnique({ where: { token } })

  if (!record) return c.json({ error: 'Token inválido', code: 'INVALID_TOKEN' }, 404)
  if (record.usedAt) return c.json({ error: 'Token já utilizado', code: 'TOKEN_USED' }, 410)

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

  const existing = await prisma.organizationMember.findFirst({ where: { userId } })
  if (existing) {
    return c.json({ error: 'Usuário já pertence a uma organização', code: 'ALREADY_SETUP' }, 409)
  }

  const body = await c.req.json<{
    name: string
    fantasyName?: string
    cnpj?: string
    segment?: string
    employeeCountAtSignup?: string
    documentationToday?: string
    mainProblem?: string
    referralSource?: string
  }>()

  if (!body.name?.trim()) {
    return c.json({ error: 'Nome da organização é obrigatório', code: 'VALIDATION_ERROR' }, 400)
  }

  const slug =
    body.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') +
    '-' +
    Date.now()

  const org = await prisma.organization.create({
    data: {
      name: body.name.trim(),
      slug,
      fantasyName: body.fantasyName?.trim() || null,
      cnpj: body.cnpj?.replace(/\D/g, '') || null,
      segment: body.segment || null,
      employeeCountAtSignup: body.employeeCountAtSignup || null,
      members: { create: { userId, role: 'admin' } },
      onboarding: {
        create: {
          documentationToday: body.documentationToday || null,
          mainProblem: body.mainProblem || null,
          referralSource: body.referralSource || null,
          completedAt: new Date(),
        },
      },
    },
  })

  await prisma.onboardingToken.update({
    where: { token },
    data: { usedAt: new Date(), organizationId: org.id },
  })

  return c.json({ organizationId: org.id }, 201)
})

export default onboarding
