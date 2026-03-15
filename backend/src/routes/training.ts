import { Hono } from 'hono'
import prisma from '../lib/prisma.js'

const training = new Hono()

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
        },
      },
      assignee: { select: { name: true } },
    },
  })

  if (!assignment) {
    return c.json({ error: 'Treinamento não encontrado', code: 'NOT_FOUND' }, 404)
  }

  return c.json(assignment)
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
      status: 'completed',
      completedAt: new Date(),
    },
  })

  return c.json(updated)
})

export default training
