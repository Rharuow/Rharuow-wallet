import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const objectStorageRoot = path.resolve(
  process.cwd(),
  process.env.REPORT_OBJECT_STORAGE_ROOT ?? '.data/report-objects',
)

function normalizeObjectKey(key: string) {
  const normalized = key.replace(/\\/g, '/').replace(/^\/+/, '')

  if (!normalized || normalized.includes('..')) {
    throw new Error('OBJECT_STORAGE_INVALID_KEY')
  }

  return normalized
}

function resolveObjectPath(key: string) {
  return path.join(objectStorageRoot, normalizeObjectKey(key))
}

export async function putObject(input: {
  key: string
  body: Buffer
}) {
  const objectPath = resolveObjectPath(input.key)
  await mkdir(path.dirname(objectPath), { recursive: true })
  await writeFile(objectPath, input.body)

  return {
    key: normalizeObjectKey(input.key),
    size: input.body.byteLength,
  }
}

export async function getObject(input: {
  key: string
}) {
  const body = await readFile(resolveObjectPath(input.key))

  return {
    key: normalizeObjectKey(input.key),
    body,
    size: body.byteLength,
  }
}