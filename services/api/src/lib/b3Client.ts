/**
 * b3Client
 *
 * Cliente HTTP centralizado para a brapi.dev.
 * Injeta o token em todas as requisições e lança erros tipados.
 */

const BASE_URL = process.env.BRAPI_BASE_URL ?? 'https://brapi.dev/api'
const TOKEN = process.env.BRAPI_TOKEN ?? ''

export class B3ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'B3ApiError'
  }
}

type RequestOptions = {
  params?: Record<string, string>
}

export async function b3Fetch<T>(
  path: string,
  { params = {} }: RequestOptions = {},
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`)

  url.searchParams.set('token', TOKEN)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url.toString())

  if (!response.ok) {
    throw new B3ApiError(
      response.status,
      `brapi.dev error: ${response.status} ${response.statusText} — ${path}`,
    )
  }

  return response.json() as Promise<T>
}
