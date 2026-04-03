export interface AOPEvent {
  spec: string
  session_id: string
  parent_session_id: string | null
  agent_id: string
  agent_version?: string
  sequence: number
  timestamp: string
  type: string
  payload: Record<string, unknown>
}

export interface Session {
  id: string
  agent_id: string
  parent_session_id: string | null
  goal: string | null
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout'
  started_at: string
  ended_at: string | null
  total_steps: number
  total_tokens: number
  total_cost_usd: number | null
  last_seen_at: string
}

export interface Alert {
  session_id: string
  type: 'loop' | 'stall' | 'cost_spike' | 'confidence_drop' | 'error_cascade'
  message: string
  severity: 'info' | 'warning' | 'critical'
  created_at: string
}

export interface CollectorConfig {
  port?: number
  dbPath?: string
  openBrowser?: boolean
}
