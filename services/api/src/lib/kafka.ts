import { Admin, Consumer, Kafka, Partitioners, Producer, SASLOptions } from 'kafkajs'

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
let admin: Admin | null = null
const ensuredTopics = new Set<string>()
const pendingTopicEnsures = new Map<string, Promise<void>>()

function getTopicPartitions() {
  const raw = Number(process.env.KAFKA_TOPIC_NUM_PARTITIONS ?? '1')
  return Number.isInteger(raw) && raw > 0 ? raw : 1
}

function getTopicReplicationFactor() {
  const raw = Number(process.env.KAFKA_TOPIC_REPLICATION_FACTOR ?? '3')
  return Number.isInteger(raw) && raw > 0 ? raw : 3
}

function shouldAutoEnsureTopics() {
  return process.env.KAFKA_AUTO_ENSURE_TOPICS !== 'false'
}

function isInvalidReplicationFactorError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false
  }

  const aggregateErrors = (error as { errors?: unknown[] }).errors
  if (!Array.isArray(aggregateErrors)) {
    return false
  }

  return aggregateErrors.some((innerError) => {
    if (!innerError || typeof innerError !== 'object') {
      return false
    }

    const typedInnerError = innerError as {
      type?: string
      code?: number
      message?: string
    }

    return (
      typedInnerError.type === 'INVALID_REPLICATION_FACTOR' ||
      typedInnerError.code === 38 ||
      typedInnerError.message?.includes('Replication-factor is invalid')
    )
  })
}

async function createTopicWithReplicationFactor(
  kafkaAdmin: Admin,
  topic: string,
  replicationFactor: number,
) {
  await kafkaAdmin.createTopics({
    waitForLeaders: true,
    topics: [
      {
        topic,
        numPartitions: getTopicPartitions(),
        replicationFactor,
      },
    ],
  })
}

async function getKafkaAdmin(): Promise<Admin> {
  if (!admin) {
    admin = kafka.admin()
    await admin.connect()
  }

  return admin
}

export async function ensureKafkaTopic(topic: string): Promise<void> {
  if (!shouldAutoEnsureTopics() || ensuredTopics.has(topic)) {
    return
  }

  const pending = pendingTopicEnsures.get(topic)
  if (pending) {
    await pending
    return
  }

  const ensurePromise = (async () => {
    const kafkaAdmin = await getKafkaAdmin()
    const preferredReplicationFactor = getTopicReplicationFactor()

    try {
      await createTopicWithReplicationFactor(
        kafkaAdmin,
        topic,
        preferredReplicationFactor,
      )
    } catch (error) {
      if (
        preferredReplicationFactor > 1 &&
        isInvalidReplicationFactorError(error)
      ) {
        console.warn('[kafka] topic-create-retry-single-replica', {
          topic,
          preferredReplicationFactor,
          fallbackReplicationFactor: 1,
        })
        await createTopicWithReplicationFactor(kafkaAdmin, topic, 1)
      } else {
        throw error
      }
    }

    ensuredTopics.add(topic)
  })()

  pendingTopicEnsures.set(topic, ensurePromise)

  try {
    await ensurePromise
  } finally {
    pendingTopicEnsures.delete(topic)
  }
}

export async function getKafkaProducer(): Promise<Producer> {
  if (!producer) {
    producer = kafka.producer({
      createPartitioner: Partitioners.LegacyPartitioner,
    })
    await producer.connect()
  }
  return producer
}

export function createKafkaConsumer(groupId: string): Consumer {
  return kafka.consumer({ groupId })
}

export interface UserRegisteredPayload {
  userId: string
  email: string
  name: string | null
  passwordHash: string
  registeredAt: Date | string
}

export async function publishUserRegistered(payload: UserRegisteredPayload): Promise<void> {
  const prod = await getKafkaProducer()
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
