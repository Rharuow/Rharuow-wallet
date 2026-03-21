import { Kafka, Producer, SASLOptions } from 'kafkajs'

const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9092')
  .split(',')
  .map((b) => b.trim())

const username = process.env.KAFKA_USERNAME
const password = process.env.KAFKA_PASSWORD

const sasl: SASLOptions | undefined =
  username && password
    ? { mechanism: 'plain', username, password }
    : undefined

const kafka = new Kafka({
  clientId: 'rharuow-wallet',
  brokers,
  ssl: !!sasl,
  sasl,
})

let producer: Producer | null = null

async function getProducer(): Promise<Producer> {
  if (!producer) {
    producer = kafka.producer()
    await producer.connect()
  }
  return producer
}

export interface UserRegisteredPayload {
  userId: string
  email: string
  name: string | null
  passwordHash: string
  registeredAt: Date | string
}

export async function publishUserRegistered(payload: UserRegisteredPayload): Promise<void> {
  const prod = await getProducer()
  await prod.send({
    topic: 'rharuow.user.registered',
    messages: [
      {
        key: payload.userId,
        value: JSON.stringify(payload),
      },
    ],
  })
}
