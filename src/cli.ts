#!/usr/bin/env node
import pc from 'picocolors'
import { startCollector } from './index'

const args = process.argv.slice(2)
const command = args[0]

if (command === 'start') {
  console.log('')
  console.log(pc.green('●') + ' ' + pc.white('aop') + pc.gray(' — Agent Observability Protocol'))
  console.log('')

  startCollector({
    port: 4317,
    openBrowser: true,
  }).then(() => {
    console.log(pc.gray('  collector ') + ' ' + pc.white('http://localhost:4317'))
    console.log(pc.gray('  dashboard ') + ' ' + pc.white('http://localhost:4317/dashboard/'))
    console.log('')
    console.log(pc.gray('  ready. waiting for agents...'))
    console.log('')

    const shutdown = async () => {
      console.log('')
      console.log(pc.gray('  shutting down...'))
      process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
  }).catch(err => {
    console.error(pc.red('  error: ') + err.message)
    process.exit(1)
  })
} else {
  console.log('')
  console.log(pc.green('●') + ' ' + pc.white('aop') + pc.gray(' collector'))
  console.log('')
  console.log(pc.gray('  usage:'))
  console.log(pc.gray('    npx @useaop/collector start'))
  console.log('')
}
