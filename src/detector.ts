import type { AOPEvent, Alert } from './types'
import type { AOPDatabase } from './database'
import type { Broadcaster } from './broadcaster'

export class AnomalyDetector {
  private toolCallHistory = new Map<string, { tool: string; timestamp: number }[]>()

  constructor(
    private db: AOPDatabase,
    private broadcaster: Broadcaster
  ) {}

  analyse(event: AOPEvent): void {
    this.detectLoop(event)
    this.detectConfidenceDrop(event)
    this.detectErrorCascade(event)
  }

  private detectLoop(event: AOPEvent): void {
    if (event.type !== 'operation.tool_start') return

    const tool = event.payload.tool as string
    const sessionId = event.session_id
    const now = Date.now()
    const windowMs = 60_000

    if (!this.toolCallHistory.has(sessionId)) {
      this.toolCallHistory.set(sessionId, [])
    }

    const history = this.toolCallHistory.get(sessionId)!
    history.push({ tool, timestamp: now })

    const recent = history.filter(h => now - h.timestamp < windowMs)
    this.toolCallHistory.set(sessionId, recent)

    const toolCalls = recent.filter(h => h.tool === tool)
    if (toolCalls.length >= 3) {
      const alert: Omit<Alert, 'created_at'> = {
        session_id: sessionId,
        type: 'loop',
        message: `Possible loop detected — "${tool}" called ${toolCalls.length} times in the last 60 seconds`,
        severity: 'warning',
      }
      this.db.insertAlert(alert)
      this.broadcaster.broadcastAlert({ ...alert, created_at: new Date().toISOString() })
      this.toolCallHistory.set(sessionId, [])
    }
  }

  private consecutiveLowConfidence = new Map<string, number>()

  private detectConfidenceDrop(event: AOPEvent): void {
    if (event.type !== 'cognition.thought') return

    const sessionId = event.session_id
    const confidence = event.payload.confidence as string | undefined

    if (confidence === 'low') {
      const count = (this.consecutiveLowConfidence.get(sessionId) ?? 0) + 1
      this.consecutiveLowConfidence.set(sessionId, count)

      if (count >= 3) {
        const alert: Omit<Alert, 'created_at'> = {
          session_id: sessionId,
          type: 'confidence_drop',
          message: `Agent expressed low confidence ${count} times in a row`,
          severity: 'warning',
        }
        this.db.insertAlert(alert)
        this.broadcaster.broadcastAlert({ ...alert, created_at: new Date().toISOString() })
        this.consecutiveLowConfidence.set(sessionId, 0)
      }
    } else {
      this.consecutiveLowConfidence.set(sessionId, 0)
    }
  }

  private consecutiveErrors = new Map<string, number>()

  private detectErrorCascade(event: AOPEvent): void {
    if (event.type !== 'operation.tool_end') return

    const sessionId = event.session_id
    const success = event.payload.success as boolean

    if (!success) {
      const count = (this.consecutiveErrors.get(sessionId) ?? 0) + 1
      this.consecutiveErrors.set(sessionId, count)

      if (count >= 3) {
        const alert: Omit<Alert, 'created_at'> = {
          session_id: sessionId,
          type: 'error_cascade',
          message: `${count} consecutive tool failures detected`,
          severity: 'critical',
        }
        this.db.insertAlert(alert)
        this.broadcaster.broadcastAlert({ ...alert, created_at: new Date().toISOString() })
        this.consecutiveErrors.set(sessionId, 0)
      }
    } else {
      this.consecutiveErrors.set(sessionId, 0)
    }
  }
}
