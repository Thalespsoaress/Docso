import { Hono } from 'hono'
import { randomBytes } from 'crypto'
import { Resend } from 'resend'
import { authMiddleware } from '../middleware/auth.js'
import prisma from '../lib/prisma.js'

type AuthVars = { Variables: { userId: string; organizationId: string; role: string } }

const training = new Hono<AuthVars>()
const resend = new Resend(process.env.RESEND_API_KEY)

const FRONTEND_URL = process.env['FRONTEND_URL'] ?? 'https://app.docso.app'

// ── Rotas protegidas ──────────────────────────────────────────────────────────

const protectedRoutes = new Hono<AuthVars>()
protectedRoutes.use('*', authMiddleware)

// Lista assignments do processo (admin/manager)
protectedRoutes.get('/processo/:processId', async (c) => {
  const organizationId = c.get('organizationId')
  const { processId } = c.req.param()

  const assignments = await prisma.trainingAssignment.findMany({
    where: { processId, organizationId },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return c.json(assignments)
})

// Atribui treinamento a membros
protectedRoutes.post('/', async (c) => {
  const role = c.get('role')
  if (role !== 'admin' && role !== 'manager') {
    return c.json({ error: 'Sem permissão para atribuir treinamentos', code: 'FORBIDDEN' }, 403)
  }

  const organizationId = c.get('organizationId')
  const assignedBy = c.get('userId')
  const body = await c.req.json<{ processId: string; userIds: string[] }>()

  if (!body.processId || !Array.isArray(body.userIds) || body.userIds.length === 0) {
    return c.json({ error: 'processId e userIds são obrigatórios', code: 'VALIDATION_ERROR' }, 400)
  }

  const processRecord = await prisma.process.findFirst({
    where: { id: body.processId, organizationId, status: 'published' },
  })
  if (!processRecord) {
    return c.json({ error: 'Processo não encontrado ou não publicado', code: 'NOT_FOUND' }, 404)
  }

  const org = await prisma.organization.findUnique({ where: { id: organizationId } })
  if (!org) return c.json({ error: 'Organização não encontrada', code: 'NOT_FOUND' }, 404)

  const results: { userId: string; status: 'assigned' | 'already_assigned' | 'not_member' | 'error' }[] = []

  for (const userId of body.userIds) {
    const membership = await prisma.organizationMember.findFirst({
      where: { userId, organizationId },
      include: { user: { select: { email: true, name: true } } },
    })

    if (!membership) {
      results.push({ userId, status: 'not_member' })
      continue
    }

    const existing = await prisma.trainingAssignment.findFirst({
      where: { processId: body.processId, assignedTo: userId, status: { not: 'completed' } },
    })
    if (existing) {
      results.push({ userId, status: 'already_assigned' })
      continue
    }

    const token = randomBytes(24).toString('hex')
    await prisma.trainingAssignment.create({
      data: {
        organizationId,
        processId: body.processId,
        assignedTo: userId,
        assignedBy,
        token,
      },
    })

    const link = `${FRONTEND_URL}/treinamento/${token}`
    const { email, name } = membership.user

    const isDev = process.env['NODE_ENV'] !== 'production'
    if (isDev) {
      console.log(`\n[TREINAMENTO] ${email} → ${link}\n`)
      results.push({ userId, status: 'assigned' })
      continue
    }

    const { error: sendError } = await resend.emails.send({
      from: 'Docso <noreply@docso.app>',
      to: email,
      subject: `Novo treinamento: ${processRecord.title}`,
      html: `
        <p>Olá, ${name}!</p>
        <p>Você recebeu um novo treinamento em <strong>${org.name}</strong>:</p>
        <p><strong>${processRecord.title}</strong></p>
        ${processRecord.objective ? `<p>${processRecord.objective}</p>` : ''}
        <p><a href="${link}">Acessar treinamento</a></p>
        <p style="color:#999;font-size:12px">Se não esperava este email, pode ignorá-lo.</p>
      `,
    })

    results.push({ userId, status: sendError ? 'error' : 'assigned' })
    if (sendError) console.error('Resend error:', sendError)
  }

  return c.json({ results }, 201)
})

training.route('/', protectedRoutes)

// ── Rotas públicas (token) ────────────────────────────────────────────────────

training.get('/:token', async (c) => {
  const { token } = c.req.param()

  const assignment = await prisma.trainingAssignment.findUnique({
    where: { token },
    include: {
      process: {
        select: {
          id: true,
          title: true,
          objective: true,
          executor: true,
          frequency: true,
          steps: true,
          gateways: true,
          quiz: true,
        },
      },
      assignee: { select: { name: true } },
      organization: { select: { name: true } },
    },
  })

  if (!assignment) {
    return c.json({ error: 'Treinamento não encontrado', code: 'NOT_FOUND' }, 404)
  }

  // Remover gabarito antes de enviar ao aluno
  type RawQuestion = { id: string; question: string; options: string[]; correct: number }
  const rawQuiz = assignment.process.quiz
  const quiz = Array.isArray(rawQuiz)
    ? (rawQuiz as RawQuestion[]).map(({ correct: _c, ...q }) => q)
    : null

  return c.json({ ...assignment, process: { ...assignment.process, quiz } })
})

training.post('/:token/start', async (c) => {
  const { token } = c.req.param()

  const assignment = await prisma.trainingAssignment.findUnique({ where: { token } })
  if (!assignment) {
    return c.json({ error: 'Treinamento não encontrado', code: 'NOT_FOUND' }, 404)
  }

  if (assignment.status === 'completed') {
    return c.json({ error: 'Treinamento já concluído', code: 'ALREADY_COMPLETED' }, 400)
  }

  const updated = await prisma.trainingAssignment.update({
    where: { token },
    data: {
      status: 'in_progress',
      startedAt: assignment.startedAt ?? new Date(),
    },
  })

  return c.json(updated)
})

training.post('/:token/complete', async (c) => {
  const { token } = c.req.param()
  const body = await c.req.json<{ answers?: number[] }>()

  const assignment = await prisma.trainingAssignment.findUnique({
    where: { token },
    include: { process: { select: { quiz: true } } },
  })
  if (!assignment) {
    return c.json({ error: 'Treinamento não encontrado', code: 'NOT_FOUND' }, 404)
  }

  if (assignment.status === 'completed') {
    return c.json({ error: 'Treinamento já concluído', code: 'ALREADY_COMPLETED' }, 400)
  }

  // Validar quiz se o processo tiver perguntas
  type RawQuestion = { id: string; question: string; options: string[]; correct: number }
  const quiz = Array.isArray(assignment.process.quiz)
    ? (assignment.process.quiz as RawQuestion[])
    : null

  if (quiz && quiz.length > 0) {
    const answers = body.answers ?? []
    const correctCount = answers.filter((ans, i) => ans === quiz[i]?.correct).length
    const score = Math.round((correctCount / quiz.length) * 100)
    if (score < 70) {
      const results = quiz.map((q, i) => ({
        correct: answers[i] === q.correct,
        correctIndex: q.correct,
      }))
      return c.json({ passed: false, score, results, code: 'QUIZ_FAILED' }, 400)
    }
  }

  const updated = await prisma.trainingAssignment.update({
    where: { token },
    data: { status: 'completed', completedAt: new Date() },
  })

  return c.json({ ...updated, passed: true })
})

export default training
