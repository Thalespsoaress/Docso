import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { authMiddleware } from '../middleware/auth.js'
import prisma from '../lib/prisma.js'

type AuthVars = { Variables: { userId: string; organizationId: string } }

const captureSessions = new Hono<AuthVars>()

captureSessions.use('*', authMiddleware)
captureSessions.use('POST', bodyLimit({ maxSize: 5 * 1024 * 1024 })) // 5 MB por sessão

captureSessions.post('/', async (c) => {
  const organizationId = c.get('organizationId')
  const userId = c.get('userId')
  const body = await c.req.json<{
    rawEvents: unknown[]
    contextForm?: unknown
  }>()

  if (!body.rawEvents || !Array.isArray(body.rawEvents)) {
    return c.json({ error: 'rawEvents é obrigatório', code: 'VALIDATION_ERROR' }, 400)
  }

  if (body.rawEvents.length > 1000) {
    return c.json({ error: 'Sessão excede o limite de 1000 eventos', code: 'VALIDATION_ERROR' }, 400)
  }

  const session = await prisma.captureSession.create({
    data: {
      organizationId,
      createdBy: userId,
      rawEvents: body.rawEvents as object[],
      contextForm: body.contextForm ? (body.contextForm as object) : undefined,
    },
  })

  return c.json(session, 201)
})

captureSessions.patch('/:id', async (c) => {
  const organizationId = c.get('organizationId')
  const { id } = c.req.param()
  const body = await c.req.json<{ processId?: string }>()

  const existing = await prisma.captureSession.findFirst({ where: { id, organizationId } })
  if (!existing) {
    return c.json({ error: 'Sessão não encontrada', code: 'NOT_FOUND' }, 404)
  }

  if (body.processId) {
    const process = await prisma.process.findFirst({
      where: { id: body.processId, organizationId },
    })
    if (!process) {
      return c.json({ error: 'Processo não encontrado', code: 'NOT_FOUND' }, 404)
    }
  }

  const updated = await prisma.captureSession.update({
    where: { id },
    data: { ...(body.processId !== undefined && { processId: body.processId }) },
  })

  return c.json(updated)
})

export default captureSessions
