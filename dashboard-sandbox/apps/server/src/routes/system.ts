import type { FastifyPluginAsync } from 'fastify'
import { calendarStatus } from '../services/calendar.js'
import { startSystemMonitor, systemStatus } from '../services/system.js'

const routes: FastifyPluginAsync = async (app) => {
  startSystemMonitor()
  // Pi health (CPU, temperature, throttling, memory, disk, network) with 30 minutes of history.
  app.get('/', async () => ({ ...(await systemStatus()), calendar: calendarStatus() }))
}

export default routes
