import { seed } from './lib/seed'
import { buildServer } from './app'
import { appLogger } from './lib/logger'

async function bootstrap() {
  const server = await buildServer()

  const port = Number(process.env.PORT ?? 3001)
  await server.listen({ port, host: '0.0.0.0' })

  // --- Seed: Root role + usuário default ---
  await seed()
}

bootstrap().catch((err) => {
  appLogger.error('api-bootstrap-failed', {
    error: err instanceof Error ? err.message : String(err),
  })
  process.exit(1)
})
