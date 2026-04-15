import { AssetReportAssetType } from '@prisma/client'
import { ensureKafkaTopic, getKafkaProducer } from '../../lib/kafka'

export const REPORT_ANALYSIS_REQUESTED_TOPIC = 'rharuow.report.analysis.requested'

export interface ReportAnalysisRequestedPayload {
  jobId: string
  userId: string
  assetType: AssetReportAssetType
  ticker: string
  requestMode: 'AUTO_WEB' | 'MANUAL_UPLOAD'
}

function resolveKafkaTimeoutMs() {
  const raw = Number(process.env.REPORT_JOBS_KAFKA_TIMEOUT_MS ?? '10000')
  return Number.isFinite(raw) && raw > 0 ? raw : 10000
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, stage: string): Promise<T> {
  let timeoutId: NodeJS.Timeout | null = null

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`REPORT_JOB_DISPATCH_TIMEOUT:${stage}`))
    }, timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

export async function publishReportAnalysisRequested(
  payload: ReportAnalysisRequestedPayload,
) {
  if (
    process.env.NODE_ENV === 'test' ||
    process.env.REPORT_JOBS_DISABLE_KAFKA === 'true'
  ) {
    return
  }

  const timeoutMs = resolveKafkaTimeoutMs()

  await withTimeout(
    ensureKafkaTopic(REPORT_ANALYSIS_REQUESTED_TOPIC),
    timeoutMs,
    'ensure-topic',
  )

  const producer = await withTimeout(
    getKafkaProducer(),
    timeoutMs,
    'producer-connect',
  )

  await withTimeout(producer.send({
    topic: REPORT_ANALYSIS_REQUESTED_TOPIC,
    messages: [
      {
        key: `${payload.assetType}:${payload.ticker}`,
        value: JSON.stringify(payload),
      },
    ],
  }), timeoutMs, 'producer-send')
}

export function parseReportAnalysisRequestedPayload(value: Buffer | string) {
  const raw = typeof value === 'string' ? value : value.toString('utf8')
  return JSON.parse(raw) as ReportAnalysisRequestedPayload
}
