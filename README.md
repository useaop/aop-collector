# @useaop/collector

Local event collector, real-time dashboard, and anomaly detector for the [Agent Observability Protocol](https://useaop.dev).

## Quick Start

```bash
npx @useaop/collector start
```

```
● aop — Agent Observability Protocol

  collector  http://localhost:4317
  dashboard  http://localhost:4317/dashboard/

  ready. waiting for agents...
```

One command gives you:
- **Collector** on `:4317` — receives events from your agents via HTTP
- **Dashboard** at `/dashboard/` — real-time UI to watch your agents think, with live event streaming
- **SQLite storage** — all events persisted locally at `~/.aop/events.db`

The dashboard opens automatically in your browser. Run an instrumented agent and watch events stream in live.

## Dashboard

The bundled dashboard provides:
- **Sessions overview** — all active and completed sessions with status, cost, and duration
- **Live session detail** — real-time event feed as your agent runs, with metrics and confidence indicators
- **Anomaly alerts** — inline warnings when loops, confidence drops, or error cascades are detected

## API

| Endpoint | Description |
|----------|-------------|
| `POST /events` | Receive an AOP event |
| `GET /stream` | SSE stream of all incoming events and alerts |
| `GET /sessions` | List all sessions |
| `GET /sessions/:id` | Get session with all events and alerts |
| `GET /sessions/:id/export` | Export session as JSONL |
| `DELETE /sessions/:id` | Delete a session and its events |
| `GET /health` | Health check |
| `GET /dashboard/` | Real-time dashboard UI |

## Anomaly Detection

The collector automatically detects:

- **Loop detection** — same tool called 3+ times with similar inputs within 60 seconds
- **Confidence drop** — agent expresses low confidence 3 times in a row
- **Error cascade** — 3 consecutive tool failures

Alerts are broadcast via SSE and displayed inline in the dashboard.

## Storage

Events are stored in SQLite at `~/.aop/events.db`. The database is created automatically on first run.

## Programmatic Usage

```typescript
import { startCollector } from '@useaop/collector'

const { server, db, broadcaster } = await startCollector({
  port: 4317,
  dbPath: '/custom/path/events.db',
  openBrowser: false,
})
```

## Community

- [Discord](https://discord.gg/wawmrFMRHG)
- [GitHub](https://github.com/useaop)
- [Documentation](https://useaop.dev/docs)

## License

MIT
