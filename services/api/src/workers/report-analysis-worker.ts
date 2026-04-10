import 'dotenv/config'
import { createKafkaConsumer, ensureKafkaTopic } from '../lib/kafka'
import {
  REPORT_ANALYSIS_REQUESTED_TOPIC,
  parseReportAnalysisRequestedPayload,
} from '../modules/reports/report-jobs.queue'
import { appLogger } from '../lib/logger'
import { processReportAnalysisRequestedJob } from '../modules/reports/report-jobs.processor'
import { listQueuedReportAnalysisJobs } from '../modules/reports/report-jobs.service'

const groupId = process.env.KAFKA_REPORT_ANALYSIS_GROUP_ID ?? 'rharuow.report-analysis.worker.v1'
const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9092')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

async function recoverQueuedJobsOnStartup() {
  const queuedJobs = await listQueuedReportAnalysisJobs()

  if (queuedJobs.length === 0) {
    return
  }

  for (const job of queuedJobs) {
    try {
      await processReportAnalysisRequestedJob({
        jobId: job.id,
        userId: job.userId,
        assetType: job.assetType,
        ticker: job.ticker,
        requestMode: job.requestMode,
      })
    } catch (error) {
      appLogger.error('report-analysis-worker-recovery-job-failed', {
        jobId: job.id,
        requestMode: job.requestMode,
        error: (error as Error).message,
      })
    }
  }
}

async function bootstrap() {
  await ensureKafkaTopic(REPORT_ANALYSIS_REQUESTED_TOPIC)

  const consumer = createKafkaConsumer(groupId)
  await consumer.connect()

  await consumer.subscribe({ topic: REPORT_ANALYSIS_REQUESTED_TOPIC, fromBeginning: false })

  await recoverQueuedJobsOnStartup()

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) {
        appLogger.warn('report-analysis-worker-message-skipped-empty')
        return
      }

      const payload = parseReportAnalysisRequestedPayload(message.value)

      try {
        await processReportAnalysisRequestedJob(payload)
      } catch (error) {
        appLogger.error('report-analysis-worker-job-process-failed', {
          jobId: payload.jobId,
          requestMode: payload.requestMode,
          error: (error as Error).message,
        })
        throw error
      }
    },
  })
}

bootstrap().catch((error) => {
  appLogger.error('report-analysis-worker-bootstrap-failed', {
    error: error instanceof Error ? error.message : String(error),
  })
  process.exit(1)
})
