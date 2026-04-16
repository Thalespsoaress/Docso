import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

import auth from './routes/auth.js'
import processes from './routes/processes.js'
import captureSessions from './routes/captureSessions.js'
import ai from './routes/ai.js'
import training from './routes/training.js'
import members, { createInviteRoutes } from './routes/members.js'
import onboarding from './routes/onboarding.js'

const REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'DATABASE_URL',
  'ANTHROPIC_API_KEY',
  'RESEND_API_KEY',
]
for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    console.error(`Variável de ambiente obrigatória ausente: ${key}`)
    process.exit(1)
  }
}

const isProd = process.env.NODE_ENV === 'production'
const ALLOWED_ORIGINS = ['https://app.docso.app', 'https://docso-rho.vercel.app']

const app = new Hono()

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return null
      if (!isProd && origin.startsWith('http://localhost:')) return origin
      return ALLOWED_ORIGINS.includes(origin) ? origin : null
    },
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  })
)

app.get('/health', (c) => c.json({ ok: true }))

app.route('/', auth)
app.route('/api/processes', processes)
app.route('/api/capture-sessions', captureSessions)
app.route('/api/ai', ai)
app.route('/api/training', training)
app.route('/api/members', members)
app.route('/', createInviteRoutes())
app.route('/', onboarding)

app.notFound((c) => c.json({ error: 'Rota não encontrada', code: 'NOT_FOUND' }, 404))
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' }, 500)
})

const port = Number(process.env.PORT ?? 3000)
console.log(`Servidor rodando na porta ${port}`)

serve({ fetch: app.fetch, port })
