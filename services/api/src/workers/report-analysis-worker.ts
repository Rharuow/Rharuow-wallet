import { createKafkaConsumer, ensureKafkaTopic } from '../lib/kafka'
import {
  REPORT_ANALYSIS_REQUESTED_TOPIC,
  parseReportAnalysisRequestedPayload,
} from '../modules/reports/report-jobs.queue'
import { processReportAnalysisRequestedJob } from '../modules/reports/report-jobs.processor'

const groupId = process.env.KAFKA_REPORT_ANALYSIS_GROUP_ID ?? 'rharuow.report-analysis.worker.v1'

async function bootstrap() {
  await ensureKafkaTopic(REPORT_ANALYSIS_REQUESTED_TOPIC)

  const consumer = createKafkaConsumer(groupId)
  await consumer.connect()
  await consumer.subscribe({ topic: REPORT_ANALYSIS_REQUESTED_TOPIC, fromBeginning: false })

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) {
        return
      }

      const payload = parseReportAnalysisRequestedPayload(message.value)
      await processReportAnalysisRequestedJob(payload)
    },
  })
}

bootstrap().catch((error) => {
  console.error('[report-analysis-worker] fatal error:', error)
  process.exit(1)
})
