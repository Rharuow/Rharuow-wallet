/**
 * Thin Redis abstraction:
 *  - Produção (Upstash): UPSTASH_REDIS_URL começa com "https://"
 *  - Local (Docker):     UPSTASH_REDIS_URL começa com "redis://"
 *
 * Expõe apenas get<T> / set com a mesma assinatura do @upstash/redis.
 */

const redisUrl = process.env.UPSTASH_REDIS_URL ?? ''

interface RedisClient {
  get<T>(key: string): Promise<T | null>
  set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown>
}

function makeUpstashClient(): RedisClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Redis } = require('@upstash/redis') as typeof import('@upstash/redis')
  return new Redis({
    url: redisUrl,
    token: process.env.UPSTASH_REDIS_TOKEN ?? '',
  })
}

function makeIoredisClient(): RedisClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { default: IORedis } = require('ioredis') as { default: typeof import('ioredis').default }
  const client = new IORedis(redisUrl)

  return {
    async get<T>(key: string): Promise<T | null> {
      const raw = await client.get(key)
      if (raw === null) return null
      try {
        return JSON.parse(raw) as T
      } catch {
        return raw as unknown as T
      }
    },
    async set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown> {
      const serialized = JSON.stringify(value)
      if (opts?.ex) {
        return client.set(key, serialized, 'EX', opts.ex)
      }
      return client.set(key, serialized)
    },
  }
}

export const redis: RedisClient = redisUrl.startsWith('https://')
  ? makeUpstashClient()
  : makeIoredisClient()

