import { Hono } from 'hono'
import { Webhook } from 'svix'
import prisma from '../lib/prisma.js'

const webhooks = new Hono()

type ClerkUserEvent = {
  type: 'user.created' | 'user.updated'
  data: {
    id: string
    email_addresses: { email_address: string }[]
    first_name: string | null
    last_name: string | null
  }
}

type ClerkOrgEvent = {
  type: 'organization.created'
  data: {
    id: string
    name: string
    slug: string
  }
}

type ClerkMemberEvent = {
  type: 'organizationMembership.created' | 'organizationMembership.deleted'
  data: {
    id: string
    organization: { id: string }
    public_user_data: { user_id: string }
    role: string
  }
}

type ClerkEvent = ClerkUserEvent | ClerkOrgEvent | ClerkMemberEvent

webhooks.post('/webhooks/clerk', async (c) => {
  const secret = process.env.CLERK_WEBHOOK_SECRET
  if (!secret) {
    return c.json({ error: 'Webhook secret não configurado', code: 'CONFIG_ERROR' }, 500)
  }

  const svixId = c.req.header('svix-id')
  const svixTimestamp = c.req.header('svix-timestamp')
  const svixSignature = c.req.header('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return c.json({ error: 'Headers svix ausentes', code: 'BAD_REQUEST' }, 400)
  }

  const body = await c.req.text()
  const wh = new Webhook(secret)

  let event: ClerkEvent
  try {
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkEvent
  } catch {
    return c.json({ error: 'Assinatura inválida', code: 'INVALID_SIGNATURE' }, 400)
  }

  try {
    if (event.type === 'user.created' || event.type === 'user.updated') {
      const { id, email_addresses, first_name, last_name } = event.data
      const email = email_addresses[0]?.email_address ?? ''
      const name = [first_name, last_name].filter(Boolean).join(' ') || email

      await prisma.user.upsert({
        where: { id },
        update: { email, name },
        create: { id, email, name },
      })
    }

    if (event.type === 'organization.created') {
      const { id, name, slug } = event.data
      await prisma.organization.upsert({
        where: { id },
        update: { name, slug },
        create: { id, name, slug },
      })
    }

    if (event.type === 'organizationMembership.created') {
      const { organization, public_user_data, role } = event.data
      await prisma.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: organization.id,
            userId: public_user_data.user_id,
          },
        },
        update: { role },
        create: {
          organizationId: organization.id,
          userId: public_user_data.user_id,
          role,
        },
      })
    }

    if (event.type === 'organizationMembership.deleted') {
      const { organization, public_user_data } = event.data
      await prisma.organizationMember.deleteMany({
        where: {
          organizationId: organization.id,
          userId: public_user_data.user_id,
        },
      })
    }

    return c.json({ ok: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return c.json({ error: 'Erro interno', code: 'INTERNAL_ERROR' }, 500)
  }
})

export default webhooks
