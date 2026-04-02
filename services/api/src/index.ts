import { seed } from './lib/seed'
import { buildServer } from './app'

async function bootstrap() {
  const server = await buildServer()

  const port = Number(process.env.PORT ?? 3001)
  await server.listen({ port, host: '0.0.0.0' })
  server.log.info(`Server running on port ${port}`)
  server.log.info(`Swagger docs available at http://localhost:${port}/docs`)

  // --- Seed: Root role + usuário default ---
  await seed(server.log)
}

bootstrap().catch((err) => {
  console.error(err)
  process.exit(1)
})
