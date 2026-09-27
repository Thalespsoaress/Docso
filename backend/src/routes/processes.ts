import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.js'
import prisma from '../lib/prisma.js'

type AuthVars = { Variables: { userId: string; organizationId: string; role: string } }

const WRITER_ROLES = ['admin', 'manager']

const processes = new Hono<AuthVars>()

processes.use('*', authMiddleware)

processes.get('/', async (c) => {
  const organizationId = c.get('organizationId')

  const items = await prisma.process.findMany({
    where: { organizationId, status: { not: 'archived' } },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      objective: true,
      executor: true,
      frequency: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      publishedAt: true,
      creator: { select: { id: true, name: true } },
    },
  })

  return c.json(items)
})

processes.post('/', async (c) => {
  if (!WRITER_ROLES.includes(c.get('role'))) {
    return c.json({ error: 'Sem permissão para criar processos', code: 'FORBIDDEN' }, 403)
  }

  const organizationId = c.get('organizationId')
  const userId = c.get('userId')
  const body = await c.req.json<{
    title: string
    objective?: string
    executor?: string
    frequency?: string
    steps?: unknown[]
    metadata?: object
    quiz?: unknown[]
  }>()

  if (!body.title) {
    return c.json({ error: 'Título é obrigatório', code: 'VALIDATION_ERROR' }, 400)
  }

  const process = await prisma.process.create({
    data: {
      organizationId,
      createdBy: userId,
      title: body.title,
      objective: body.objective,
      executor: body.executor,
      frequency: body.frequency,
      steps: (body.steps ?? []) as object[],
      ...(body.metadata !== undefined && { metadata: body.metadata }),
      ...(body.quiz !== undefined && { quiz: body.quiz as object[] }),
    },
  })

  return c.json(process, 201)
})

processes.get('/:id', async (c) => {
  const organizationId = c.get('organizationId')
  const { id } = c.req.param()

  const process = await prisma.process.findFirst({
    where: { id, organizationId },
    include: { creator: { select: { id: true, name: true } } },
  })

  if (!process) {
    return c.json({ error: 'Processo não encontrado', code: 'NOT_FOUND' }, 404)
  }

  return c.json(process)
})

processes.patch('/:id', async (c) => {
  if (!WRITER_ROLES.includes(c.get('role'))) {
    return c.json({ error: 'Sem permissão para editar processos', code: 'FORBIDDEN' }, 403)
  }

  const organizationId = c.get('organizationId')
  const { id } = c.req.param()
  const body = await c.req.json<{
    title?: string
    objective?: string
    executor?: string
    frequency?: string
    steps?: unknown[]
    gateways?: unknown[]
    status?: string
    metadata?: object
    quiz?: unknown[]
  }>()

  const existing = await prisma.process.findFirst({ where: { id, organizationId } })
  if (!existing) {
    return c.json({ error: 'Processo não encontrado', code: 'NOT_FOUND' }, 404)
  }

  const VALID_STATUSES = ['draft', 'published', 'archived']
  if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
    return c.json({ error: 'Status inválido', code: 'VALIDATION_ERROR' }, 400)
  }

  const publishedAt =
    body.status === 'published' && existing.status !== 'published' ? new Date() : undefined

  const updated = await prisma.process.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.objective !== undefined && { objective: body.objective }),
      ...(body.executor !== undefined && { executor: body.executor }),
      ...(body.frequency !== undefined && { frequency: body.frequency }),
      ...(body.steps !== undefined && { steps: body.steps as object[] }),
      ...(body.gateways !== undefined && { gateways: body.gateways as object[] }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.metadata !== undefined && { metadata: body.metadata }),
      ...(body.quiz !== undefined && { quiz: body.quiz as object[] }),
      ...(publishedAt && { publishedAt }),
    },
  })

  return c.json(updated)
})

processes.delete('/:id', async (c) => {
  if (!WRITER_ROLES.includes(c.get('role'))) {
    return c.json({ error: 'Sem permissão para arquivar processos', code: 'FORBIDDEN' }, 403)
  }

  const organizationId = c.get('organizationId')
  const { id } = c.req.param()

  const existing = await prisma.process.findFirst({ where: { id, organizationId } })
  if (!existing) {
    return c.json({ error: 'Processo não encontrado', code: 'NOT_FOUND' }, 404)
  }

  await prisma.process.update({ where: { id }, data: { status: 'archived' } })

  return c.json({ ok: true })
})

export default processes
