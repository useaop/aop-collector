import Database from 'better-sqlite3'
import path from 'path'
import os from 'os'
import fs from 'fs'
import type { AOPEvent, Session, Alert } from './types'

export class AOPDatabase {
  private db: Database.Database

  constructor(dbPath?: string) {
    const resolvedPath = dbPath ?? path.join(os.homedir(), '.aop', 'events.db')
    const dir = path.dirname(resolvedPath)

    fs.mkdirSync(dir, { recursive: true })

    this.db = new Database(resolvedPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.migrate()
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        parent_session_id TEXT,
        agent_id TEXT NOT NULL,
        agent_version TEXT,
        sequence INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id);
      CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        parent_session_id TEXT,
        goal TEXT,
        status TEXT NOT NULL DEFAULT 'running',
        started_at TEXT NOT NULL,
        ended_at TEXT,
        total_steps INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        total_cost_usd REAL,
        last_seen_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'warning',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `)
  }

  insertEvent(event: AOPEvent): void {
    const insert = this.db.prepare(`
      INSERT INTO events (session_id, parent_session_id, agent_id, agent_version, sequence, timestamp, type, payload)
      VALUES (@session_id, @parent_session_id, @agent_id, @agent_version, @sequence, @timestamp, @type, @payload)
    `)

    insert.run({
      session_id: event.session_id,
      parent_session_id: event.parent_session_id,
      agent_id: event.agent_id,
      agent_version: event.agent_version ?? null,
      sequence: event.sequence,
      timestamp: event.timestamp,
      type: event.type,
      payload: JSON.stringify(event.payload),
    })

    this.updateSession(event)
  }

  private updateSession(event: AOPEvent): void {
    const existing = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(event.session_id) as Session | undefined

    if (!existing) {
      const goal = event.type === 'session.started'
        ? (event.payload.goal as string ?? null)
        : null

      this.db.prepare(`
        INSERT INTO sessions (id, agent_id, parent_session_id, goal, status, started_at, last_seen_at)
        VALUES (?, ?, ?, ?, 'running', ?, ?)
      `).run(event.session_id, event.agent_id, event.parent_session_id, goal, event.timestamp, event.timestamp)
    } else {
      const updates: Record<string, unknown> = { last_seen_at: event.timestamp }

      if (event.type === 'session.heartbeat') {
        updates.total_steps = event.payload.step as number ?? existing.total_steps
        updates.total_tokens = event.payload.token_spend as number ?? existing.total_tokens
      }

      if (event.type === 'session.ended') {
        updates.status = event.payload.status as string ?? 'completed'
        updates.ended_at = event.timestamp
        updates.total_steps = event.payload.total_steps as number ?? existing.total_steps
        updates.total_tokens = event.payload.total_tokens as number ?? existing.total_tokens
        updates.total_cost_usd = event.payload.total_cost_usd as number ?? null
      }

      const setClauses = Object.keys(updates).map(k => `${k} = @${k}`).join(', ')
      this.db.prepare(`UPDATE sessions SET ${setClauses} WHERE id = @id`).run({ ...updates, id: event.session_id })
    }
  }

  getSessions(): Session[] {
    return this.db.prepare(`
      SELECT * FROM sessions ORDER BY started_at DESC LIMIT 100
    `).all() as Session[]
  }

  getSession(id: string): Session | undefined {
    return this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Session | undefined
  }

  getSessionEvents(sessionId: string): AOPEvent[] {
    const rows = this.db.prepare(`
      SELECT * FROM events WHERE session_id = ? ORDER BY sequence ASC
    `).all(sessionId) as any[]

    return rows.map(row => ({
      spec: 'aop/1.0',
      session_id: row.session_id,
      parent_session_id: row.parent_session_id,
      agent_id: row.agent_id,
      agent_version: row.agent_version,
      sequence: row.sequence,
      timestamp: row.timestamp,
      type: row.type,
      payload: JSON.parse(row.payload),
    }))
  }

  getRecentEvents(sessionId: string, limit = 50): AOPEvent[] {
    const rows = this.db.prepare(`
      SELECT * FROM events WHERE session_id = ? ORDER BY sequence DESC LIMIT ?
    `).all(sessionId, limit) as any[]

    return rows.reverse().map(row => ({
      spec: 'aop/1.0',
      session_id: row.session_id,
      parent_session_id: row.parent_session_id,
      agent_id: row.agent_id,
      agent_version: row.agent_version,
      sequence: row.sequence,
      timestamp: row.timestamp,
      type: row.type,
      payload: JSON.parse(row.payload),
    }))
  }

  insertAlert(alert: Omit<Alert, 'created_at'>): void {
    this.db.prepare(`
      INSERT INTO alerts (session_id, type, message, severity)
      VALUES (@session_id, @type, @message, @severity)
    `).run(alert)
  }

  getAlerts(sessionId?: string): Alert[] {
    if (sessionId) {
      return this.db.prepare('SELECT * FROM alerts WHERE session_id = ? ORDER BY created_at DESC LIMIT 20').all(sessionId) as Alert[]
    }
    return this.db.prepare('SELECT * FROM alerts ORDER BY created_at DESC LIMIT 50').all() as Alert[]
  }

  deleteSession(id: string): void {
    this.db.prepare('DELETE FROM events WHERE session_id = ?').run(id)
    this.db.prepare('DELETE FROM alerts WHERE session_id = ?').run(id)
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id)
  }

  close(): void {
    this.db.close()
  }
}
