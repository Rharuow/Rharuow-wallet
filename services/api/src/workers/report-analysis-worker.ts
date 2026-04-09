import 'dotenv/config'
import { createKafkaConsumer, ensureKafkaTopic } from '../lib/kafka'
import {
  REPORT_ANALYSIS_REQUESTED_TOPIC,
  parseReportAnalysisRequestedPayload,
} from '../modules/reports/report-jobs.queue'
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
    console.info('[report-analysis-worker] recovery-scan-empty')
    return
  }

  console.info('[report-analysis-worker] recovery-scan-found', {
    queuedJobs: queuedJobs.length,
  })

  for (const job of queuedJobs) {
    try {
      await processReportAnalysisRequestedJob({
        jobId: job.id,
        userId: job.userId,
        assetType: job.assetType,
        ticker: job.ticker,
        requestMode: job.requestMode,
      })
      console.info('[report-analysis-worker] recovery-job-processed', {
        jobId: job.id,
        requestMode: job.requestMode,
      })
    } catch (error) {
      console.error('[report-analysis-worker] recovery-job-failed', {
        jobId: job.id,
        requestMode: job.requestMode,
        error: (error as Error).message,
      })
    }
  }
}

async function bootstrap() {
  console.info('[report-analysis-worker] startup', {
    topic: REPORT_ANALYSIS_REQUESTED_TOPIC,
    groupId,
    brokers,
    kafkaAuthEnabled: !!(process.env.KAFKA_USERNAME && process.env.KAFKA_PASSWORD),
  })

  await ensureKafkaTopic(REPORT_ANALYSIS_REQUESTED_TOPIC)
  console.info('[report-analysis-worker] topic-ready', {
    topic: REPORT_ANALYSIS_REQUESTED_TOPIC,
  })

  const consumer = createKafkaConsumer(groupId)
  await consumer.connect()
  console.info('[report-analysis-worker] consumer-connected', { groupId })

  await consumer.subscribe({ topic: REPORT_ANALYSIS_REQUESTED_TOPIC, fromBeginning: false })
  console.info('[report-analysis-worker] consumer-subscribed', {
    groupId,
    topic: REPORT_ANALYSIS_REQUESTED_TOPIC,
    fromBeginning: false,
  })

  await recoverQueuedJobsOnStartup()

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) {
        console.warn('[report-analysis-worker] message-skipped-empty')
        return
      }

      const payload = parseReportAnalysisRequestedPayload(message.value)
      console.info('[report-analysis-worker] job-received', {
        jobId: payload.jobId,
        userId: payload.userId,
        ticker: payload.ticker,
        assetType: payload.assetType,
        requestMode: payload.requestMode,
      })

      try {
        await processReportAnalysisRequestedJob(payload)
        console.info('[report-analysis-worker] job-processed', {
          jobId: payload.jobId,
          requestMode: payload.requestMode,
        })
      } catch (error) {
        console.error('[report-analysis-worker] job-process-failed', {
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
  console.error('[report-analysis-worker] fatal error:', error)
  process.exit(1)
})
