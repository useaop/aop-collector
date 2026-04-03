export { AOPDatabase } from './database'
export { Broadcaster } from './broadcaster'
export { AnomalyDetector } from './detector'
export { createServer } from './server'
export type { AOPEvent, Session, Alert, CollectorConfig } from './types'

import { AOPDatabase } from './database'
import { Broadcaster } from './broadcaster'
import { AnomalyDetector } from './detector'
import { createServer } from './server'
import type { CollectorConfig } from './types'

export async function startCollector(config: CollectorConfig = {}) {
  const {
    port = 4317,
    dbPath,
    openBrowser = false,
  } = config

  const db = new AOPDatabase(dbPath)
  const broadcaster = new Broadcaster()
  const detector = new AnomalyDetector(db, broadcaster)
  const server = createServer(db, broadcaster, detector)

  await server.listen({ port, host: '127.0.0.1' })

  if (openBrowser) {
    const { default: open } = await import('open')
    await open(`http://localhost:${port}/dashboard/`)
  }

  return { server, db, broadcaster }
}
