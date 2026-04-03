# @useaop/collector

Local event collector and server for the [Agent Observability Protocol](https://useaop.dev).

## Quick Start

```bash
npx @useaop/collector start
```

```
● aop — Agent Observability Protocol

  collector  http://localhost:4317

  ready. waiting for agents...
```

The collector receives AOP events from your agents, stores them in a local SQLite database, and provides a real-time event stream via Server-Sent Events.

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

## Anomaly Detection

The collector automatically detects:

- **Loop detection** — same tool called 3+ times with similar inputs within 60 seconds
- **Confidence drop** — agent expresses low confidence 3 times in a row
- **Error cascade** — 3 consecutive tool failures

Alerts are broadcast via SSE and stored alongside session data.

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

## License

MIT
