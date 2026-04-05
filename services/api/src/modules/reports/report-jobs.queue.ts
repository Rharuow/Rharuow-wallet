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

export async function publishReportAnalysisRequested(
  payload: ReportAnalysisRequestedPayload,
) {
  if (
    process.env.NODE_ENV === 'test' ||
    process.env.REPORT_JOBS_DISABLE_KAFKA === 'true'
  ) {
    return
  }

  await ensureKafkaTopic(REPORT_ANALYSIS_REQUESTED_TOPIC)

  const producer = await getKafkaProducer()
  await producer.send({
    topic: REPORT_ANALYSIS_REQUESTED_TOPIC,
    messages: [
      {
        key: `${payload.assetType}:${payload.ticker}`,
        value: JSON.stringify(payload),
      },
    ],
  })
}

export function parseReportAnalysisRequestedPayload(value: Buffer | string) {
  const raw = typeof value === 'string' ? value : value.toString('utf8')
  return JSON.parse(raw) as ReportAnalysisRequestedPayload
}
