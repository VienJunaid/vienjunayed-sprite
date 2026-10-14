import type { FastifyPluginAsync } from 'fastify'
import { calendarFeed } from '../services/calendar.js'

const routes: FastifyPluginAsync = async (app) => {
  // Events from the secret iCal links in .env (CALENDAR_ICS), about 40 days back to 100 ahead.
  app.get('/events', async () => calendarFeed())
}

export default routes
