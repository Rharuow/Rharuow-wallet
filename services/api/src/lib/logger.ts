type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug'

const LOG_LEVELS: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
}

function resolveLogLevel(): LogLevel {
  const rawLevel = (process.env.LOG_LEVEL ?? 'warn').toLowerCase()

  if (rawLevel in LOG_LEVELS) {
    return rawLevel as LogLevel
  }

  return 'warn'
}

function canLog(level: LogLevel) {
  return LOG_LEVELS[resolveLogLevel()] >= LOG_LEVELS[level]
}

function write(
  stream: NodeJS.WriteStream,
  level: Exclude<LogLevel, 'silent'>,
  message: string,
  context?: Record<string, unknown>,
) {
  if (!canLog(level)) {
    return
  }

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context && Object.keys(context).length > 0 ? { context } : {}),
  }

  stream.write(`${JSON.stringify(payload)}\n`)
}

export const appLogger = {
  error(message: string, context?: Record<string, unknown>) {
    write(process.stderr, 'error', message, context)
  },
  warn(message: string, context?: Record<string, unknown>) {
    write(process.stderr, 'warn', message, context)
  },
  info(message: string, context?: Record<string, unknown>) {
    write(process.stdout, 'info', message, context)
  },
  debug(message: string, context?: Record<string, unknown>) {
    write(process.stdout, 'debug', message, context)
  },
}