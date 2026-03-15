import { Hono } from 'hono'
import { Resend } from 'resend'
import { randomBytes } from 'crypto'
import { authMiddleware } from '../middleware/auth.js'
import prisma from '../lib/prisma.js'

type AuthVars = { Variables: { userId: string; organizationId: string } }

const members = new Hono<AuthVars>()

members.use('*', authMiddleware)

const resend = new Resend(process.env.RESEND_API_KEY)

members.get('/', async (c) => {
  const organizationId = c.get('organizationId')

  const items = await prisma.organizationMember.findMany({
    where: { organizationId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { joinedAt: 'asc' },
  })

  return c.json(items)
})

members.post('/invite', async (c) => {
  const organizationId = c.get('organizationId')
  const invitedBy = c.get('userId')
  const body = await c.req.json<{ email: string; role?: string; processId?: string }>()

  if (!body.email) {
    return c.json({ error: 'Email é obrigatório', code: 'VALIDATION_ERROR' }, 400)
  }

  const role = body.role ?? 'member'
  const validRoles = ['admin', 'manager', 'member']
  if (!validRoles.includes(role)) {
    return c.json({ error: 'Role inválido', code: 'VALIDATION_ERROR' }, 400)
  }

  const org = await prisma.organization.findUnique({ where: { id: organizationId } })
  if (!org) {
    return c.json({ error: 'Organização não encontrada', code: 'NOT_FOUND' }, 404)
  }

  if (body.processId) {
    const inviterMember = await prisma.organizationMember.findFirst({
      where: { organizationId, userId: invitedBy },
    })

    if (!inviterMember || !['admin', 'manager'].includes(inviterMember.role)) {
      return c.json(
        { error: 'Sem permissão para atribuir treinamentos', code: 'FORBIDDEN' },
        403
      )
    }

    const proc = await prisma.process.findFirst({
      where: { id: body.processId, organizationId },
    })
    if (!proc) {
      return c.json({ error: 'Processo não encontrado', code: 'NOT_FOUND' }, 404)
    }

    const user = await prisma.user.findUnique({ where: { email: body.email } })
    if (!user) {
      return c.json({ error: 'Usuário não encontrado', code: 'NOT_FOUND' }, 404)
    }

    const token = randomBytes(32).toString('hex')
    const assignment = await prisma.trainingAssignment.create({
      data: {
        organizationId,
        processId: body.processId,
        assignedTo: user.id,
        assignedBy: invitedBy,
        token,
      },
    })

    const frontendUrl = process.env['FRONTEND_URL'] ?? 'https://app.docso.app'
    const link = `${frontendUrl}/treinamento/${token}`

    await resend.emails.send({
      from: 'Docso <noreply@docso.app>',
      to: body.email,
      subject: `Você tem um novo treinamento: ${proc.title}`,
      html: `<p>Olá, ${user.name}!</p><p>Você foi designado para um novo treinamento: <strong>${proc.title}</strong></p><p><a href="${link}">Acessar treinamento</a></p>`,
    })

    return c.json(assignment, 201)
  }

  const link = `https://app.docso.app/convite/${org.slug}`

  await resend.emails.send({
    from: 'Docso <noreply@docso.app>',
    to: body.email,
    subject: `Você foi convidado para ${org.name} no Docso`,
    html: `<p>Você foi convidado para entrar na organização <strong>${org.name}</strong> no Docso.</p><p><a href="${link}">Aceitar convite</a></p>`,
  })

  return c.json({ ok: true, message: 'Convite enviado' })
})

export default members
