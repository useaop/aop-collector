import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import fs from 'fs'
import path from 'path'
import type { AOPDatabase } from './database'
import type { Broadcaster } from './broadcaster'
import type { AnomalyDetector } from './detector'
import type { AOPEvent } from './types'

const MAX_SSE_CONNECTIONS = 50
const MAX_BODY_SIZE = 65_536 // 64KB — more than enough for any single AOP event

export function createServer(
  db: AOPDatabase,
  broadcaster: Broadcaster,
  detector: AnomalyDetector
) {
  const app = Fastify({
    logger: false,
    bodyLimit: MAX_BODY_SIZE,
  })

  app.register(cors, {
    origin: [
      'http://localhost:3000',
      'http://localhost:4317',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:4317',
    ],
  })

  // Serve dashboard static files if available
  const dashboardPath = path.join(__dirname, '../../aop-dashboard/out')
  if (fs.existsSync(dashboardPath)) {
    app.register(fastifyStatic, {
      root: dashboardPath,
      prefix: '/',
      decorateReply: false,
    })
  }

  app.post<{ Body: AOPEvent }>('/events', async (request, reply) => {
    const event = request.body

    if (!event || !event.spec || !event.session_id || !event.type) {
      return reply.code(400).send({ error: 'Invalid AOP event: missing required fields' })
    }

    if (typeof event.session_id !== 'string' || event.session_id.length > 128) {
      return reply.code(400).send({ error: 'Invalid session_id' })
    }

    if (typeof event.type !== 'string' || event.type.length > 128) {
      return reply.code(400).send({ error: 'Invalid event type' })
    }

    if (typeof event.agent_id !== 'string' || event.agent_id.length > 128) {
      return reply.code(400).send({ error: 'Invalid agent_id' })
    }

    db.insertEvent(event)
    broadcaster.broadcastEvent(event)
    detector.analyse(event)

    return { ok: true }
  })

  app.get('/stream', (request, reply) => {
    if (broadcaster.subscriberCount >= MAX_SSE_CONNECTIONS) {
      reply.code(503).send({ error: 'Too many connections' })
      return
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    })

    const send = (data: object) => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    send({ type: 'connected', timestamp: new Date().toISOString() })

    const unsubscribe = broadcaster.subscribe((message) => {
      send(message)
    })

    const keepAlive = setInterval(() => {
      reply.raw.write(': ping\n\n')
    }, 15_000)

    request.raw.on('close', () => {
      clearInterval(keepAlive)
      unsubscribe()
    })
  })

  app.get('/sessions', async () => {
    return { sessions: db.getSessions() }
  })

  app.get<{ Params: { id: string } }>('/sessions/:id', async (request, reply) => {
    const session = db.getSession(request.params.id)
    if (!session) return reply.code(404).send({ error: 'Session not found' })
    const events = db.getSessionEvents(request.params.id)
    const alerts = db.getAlerts(request.params.id)
    return { session, events, alerts }
  })

  app.get<{ Params: { id: string } }>('/sessions/:id/export', async (request, reply) => {
    const id = request.params.id.replace(/[^a-zA-Z0-9_-]/g, '')
    const events = db.getSessionEvents(request.params.id)
    const jsonl = events.map(e => JSON.stringify(e)).join('\n')
    reply.header('Content-Type', 'application/x-ndjson')
    reply.header('Content-Disposition', `attachment; filename="session-${id}.jsonl"`)
    return jsonl
  })

  app.delete<{ Params: { id: string } }>('/sessions/:id', async (request, reply) => {
    db.deleteSession(request.params.id)
    return { ok: true }
  })

  app.get('/health', async () => {
    return { ok: true, version: '0.1.0', subscribers: broadcaster.subscriberCount }
  })

  return app
}
