import type { AOPEvent, Alert } from './types'

type BroadcastMessage =
  | { kind: 'event'; data: AOPEvent }
  | { kind: 'alert'; data: Alert }

type Subscriber = (message: BroadcastMessage) => void

export class Broadcaster {
  private subscribers = new Set<Subscriber>()

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn)
    return () => this.subscribers.delete(fn)
  }

  broadcastEvent(event: AOPEvent): void {
    const message: BroadcastMessage = { kind: 'event', data: event }
    for (const subscriber of this.subscribers) {
      try { subscriber(message) } catch { /* never crash */ }
    }
  }

  broadcastAlert(alert: Alert): void {
    const message: BroadcastMessage = { kind: 'alert', data: alert }
    for (const subscriber of this.subscribers) {
      try { subscriber(message) } catch { /* never crash */ }
    }
  }

  get subscriberCount(): number {
    return this.subscribers.size
  }
}
