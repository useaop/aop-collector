#!/usr/bin/env node
import pc from 'picocolors'
import net from 'net'
import { startCollector } from './index'

const args = process.argv.slice(2)
const command = args[0]

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(true))
    server.once('listening', () => { server.close(); resolve(false) })
    server.listen(port, '127.0.0.1')
  })
}

async function killProcessOnPort(port: number): Promise<boolean> {
  const { execFile } = await import('child_process')
  return new Promise((resolve) => {
    execFile('lsof', ['-ti', `:${port}`], (err, stdout) => {
      if (err || !stdout.trim()) { resolve(false); return }
      const pids = stdout.trim().split('\n')
      for (const pid of pids) {
        try { process.kill(parseInt(pid, 10), 'SIGTERM') } catch { }
      }
      // Wait briefly for process to exit
      setTimeout(() => resolve(true), 500)
    })
  })
}

if (command === 'start') {
  (async () => {
    const port = 4317

    console.log('')
    console.log(pc.green('●') + ' ' + pc.white('AOP') + pc.gray(' — Agent Observability Protocol'))
    console.log('')

    const inUse = await isPortInUse(port)

    if (inUse) {
      console.log(pc.yellow('  port ' + port + ' is in use') + pc.gray(' — stopping existing collector...'))
      const killed = await killProcessOnPort(port)

      if (killed) {
        const stillInUse = await isPortInUse(port)
        if (stillInUse) {
          console.error(pc.red('  error: ') + `could not free port ${port}. Run: lsof -ti:${port} | xargs kill -9`)
          process.exit(1)
        }
        console.log(pc.gray('  stopped. starting fresh...'))
        console.log('')
      } else {
        console.error(pc.red('  error: ') + `could not free port ${port}. Run: lsof -ti:${port} | xargs kill -9`)
        process.exit(1)
      }
    }

    try {
      await startCollector({ port, openBrowser: true })

      console.log(pc.gray('  collector ') + ' ' + pc.white(`http://localhost:${port}`))
      console.log(pc.gray('  dashboard ') + ' ' + pc.white(`http://localhost:${port}/dashboard/`))
      console.log('')
      console.log(pc.gray('  ready. waiting for agents...'))
      console.log('')
      console.log(pc.gray('  what are you building? → ') + pc.white('discord.gg/wawmrFMRHG'))
      console.log('')

      const shutdown = () => {
        console.log('')
        console.log(pc.gray('  shutting down...'))
        process.exit(0)
      }

      process.on('SIGINT', shutdown)
      process.on('SIGTERM', shutdown)
    } catch (err: any) {
      console.error(pc.red('  error: ') + err.message)
      process.exit(1)
    }
  })()
} else {
  console.log('')
  console.log(pc.green('●') + ' ' + pc.white('AOP') + pc.gray(' collector'))
  console.log('')
  console.log(pc.gray('  usage:'))
  console.log(pc.gray('    npx @useaop/collector start'))
  console.log('')
}
