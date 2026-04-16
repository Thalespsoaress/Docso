import { Hono } from 'hono'
import { Resend } from 'resend'
import { randomBytes } from 'crypto'
import { authMiddleware } from '../middleware/auth.js'
import { verifyJWT } from '../middleware/auth.js'
import prisma from '../lib/prisma.js'

type AuthVars = { Variables: { userId: string; organizationId: string; role: string } }

const members = new Hono<AuthVars>()
const resend = new Resend(process.env.RESEND_API_KEY)

const FRONTEND_URL = process.env['FRONTEND_URL'] ?? 'https://app.docso.app'

members.use('*', authMiddleware)

// Lista membros da organização
members.get('/', async (c) => {
  const organizationId = c.get('organizationId')

  const items = await prisma.organizationMember.findMany({
    where: { organizationId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { joinedAt: 'asc' },
  })

  return c.json(items)
})

// Lista convites pendentes
members.get('/invites', async (c) => {
  const organizationId = c.get('organizationId')

  const invites = await prisma.invite.findMany({
    where: { organizationId, usedAt: null },
    orderBy: { createdAt: 'desc' },
  })

  return c.json(invites)
})

// Envia convites — aceita array de { email, role }
members.post('/invite', async (c) => {
  if (c.get('role') !== 'admin') {
    return c.json({ error: 'Sem permissão para convidar', code: 'FORBIDDEN' }, 403)
  }

  const organizationId = c.get('organizationId')
  const invitedBy = c.get('userId')

  const body = await c.req.json<{ invites: { email: string; role: string }[] }>()
  if (!Array.isArray(body.invites) || body.invites.length === 0) {
    return c.json({ error: 'Lista de convites inválida', code: 'VALIDATION_ERROR' }, 400)
  }

  const validRoles = ['admin', 'manager', 'member']
  for (const inv of body.invites) {
    if (!inv.email?.trim()) return c.json({ error: 'Email inválido', code: 'VALIDATION_ERROR' }, 400)
    if (!validRoles.includes(inv.role)) return c.json({ error: 'Papel inválido', code: 'VALIDATION_ERROR' }, 400)
  }

  const org = await prisma.organization.findUnique({ where: { id: organizationId } })
  if (!org) return c.json({ error: 'Organização não encontrada', code: 'NOT_FOUND' }, 404)

  const results: { email: string; status: 'sent' | 'already_member' | 'error' }[] = []

  for (const inv of body.invites) {
    const email = inv.email.trim().toLowerCase()

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      const isMember = await prisma.organizationMember.findFirst({
        where: { organizationId, userId: existingUser.id },
      })
      if (isMember) {
        results.push({ email, status: 'already_member' })
        continue
      }
    }

    const token = randomBytes(24).toString('hex')
    await prisma.invite.create({
      data: { organizationId, email, role: inv.role, token, invitedBy },
    })

    const link = `${FRONTEND_URL}/convite/${token}`

    const isDev = process.env.NODE_ENV !== 'production'
    if (isDev) {
      console.log(`\n[CONVITE] ${email} → ${link}\n`)
      results.push({ email, status: 'sent' })
      continue
    }

    const { error: sendError } = await resend.emails.send({
      from: 'Docso <noreply@docso.app>',
      to: email,
      subject: `Você foi convidado para ${org.name} no Docso`,
      html: `
        <p>Olá!</p>
        <p>Você foi convidado para entrar na organização <strong>${org.name}</strong> no Docso.</p>
        <p><a href="${link}">Aceitar convite</a></p>
        <p style="color:#999;font-size:12px">Se não esperava este email, pode ignorá-lo.</p>
      `,
    })
    if (sendError) {
      console.error('Resend error:', sendError)
      results.push({ email, status: 'error' })
    } else {
      results.push({ email, status: 'sent' })
    }
  }

  return c.json({ results }, 201)
})

// Cancela convite pendente
members.delete('/invites/:id', async (c) => {
  if (c.get('role') !== 'admin') {
    return c.json({ error: 'Sem permissão', code: 'FORBIDDEN' }, 403)
  }

  const organizationId = c.get('organizationId')
  const { id } = c.req.param()

  const invite = await prisma.invite.findFirst({ where: { id, organizationId, usedAt: null } })
  if (!invite) return c.json({ error: 'Convite não encontrado', code: 'NOT_FOUND' }, 404)

  await prisma.invite.delete({ where: { id } })
  return c.json({ ok: true })
})

export { resend, FRONTEND_URL }
export default members


// ─── Rotas públicas de convite (sem authMiddleware) ──────────────────────────

export function createInviteRoutes() {
  const app = new Hono()

  // Valida token de convite
  app.get('/api/invite/:token', async (c) => {
    const { token } = c.req.param()
    const invite = await prisma.invite.findUnique({
      where: { token },
      include: { organization: { select: { name: true } } },
    })

    if (!invite) return c.json({ error: 'Convite inválido', code: 'INVALID_TOKEN' }, 404)
    if (invite.usedAt) return c.json({ error: 'Convite já utilizado', code: 'TOKEN_USED' }, 410)

    return c.json({ valid: true, email: invite.email, role: invite.role, orgName: invite.organization.name })
  })

  // Aceita convite — usuário já cadastrado faz login e chama essa rota
  app.post('/api/invite/:token/accept', async (c) => {
    const { token } = c.req.param()

    const authHeader = c.req.header('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Token não fornecido', code: 'UNAUTHORIZED' }, 401)
    }

    let userId: string
    try {
      const payload = await verifyJWT(authHeader.slice(7))
      if (!payload.sub) throw new Error()
      userId = payload.sub
    } catch {
      return c.json({ error: 'Token inválido', code: 'INVALID_TOKEN' }, 401)
    }

    const invite = await prisma.invite.findUnique({
      where: { token },
      include: { organization: { select: { id: true, name: true } } },
    })

    if (!invite) return c.json({ error: 'Convite inválido', code: 'INVALID_TOKEN' }, 404)
    if (invite.usedAt) return c.json({ error: 'Convite já utilizado', code: 'TOKEN_USED' }, 410)

    const existing = await prisma.organizationMember.findFirst({
      where: { organizationId: invite.organizationId, userId },
    })
    if (existing) return c.json({ error: 'Já é membro desta organização', code: 'ALREADY_MEMBER' }, 409)

    await prisma.organizationMember.create({
      data: { organizationId: invite.organizationId, userId, role: invite.role },
    })

    await prisma.invite.update({ where: { token }, data: { usedAt: new Date() } })

    return c.json({ organizationId: invite.organizationId }, 201)
  })

  return app
}
