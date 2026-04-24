import { createMiddleware } from 'hono/factory'

type Entry = { count: number; resetAt: number }

export function rateLimiter({ windowMs, limit }: { windowMs: number; limit: number }) {
  const store = new Map<string, Entry>()

  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (entry.resetAt < now) store.delete(key)
    }
  }, windowMs * 2).unref()

  return createMiddleware(async (c, next) => {
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0].trim() ??
      c.req.header('x-real-ip') ??
      'unknown'
    const key = `${c.req.path}:${ip}`
    const now = Date.now()

    const entry = store.get(key)
    if (!entry || entry.resetAt < now) {
      store.set(key, { count: 1, resetAt: now + windowMs })
      return next()
    }

    if (entry.count >= limit) {
      c.header('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)))
      return c.json(
        { error: 'Muitas requisições. Tente novamente mais tarde.', code: 'RATE_LIMITED' },
        429
      )
    }

    entry.count++
    return next()
  })
}
