import { redis } from '../../lib/redis'
import { fetchFundamentusFiis, type FundamentusFii } from '../../lib/fundamentusClient'
import type { FiiListQuery, FiiListResponse, FiiItem } from './fiis.schema'

// ----------------------------------------------------------------
// Cache
// ----------------------------------------------------------------

/** Chave para a lista completa de FIIs cacheada no Redis  */
const CACHE_KEY = 'fundamentus:fiis:all:v2'

/**
 * TTL em segundos para o cache da lista completa.
 * O Fundamentus é atualizado durante o pregão (aprox. a cada hora).
 * Usamos 1 hora fora do pregão e 10 minutos durante.
 */
function listTtl(): number {
  const now = new Date()
  const brt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const day = brt.getDay()
  if (day === 0 || day === 6) return 60 * 60 // fim de semana → 1h

  const total = brt.getHours() * 60 + brt.getMinutes()
  const open = 10 * 60         // 10:00 BRT
  const close = 17 * 60 + 55  // 17:55 BRT

  return total >= open && total <= close ? 10 * 60 : 60 * 60
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

/**
 * Retorna a lista completa de FIIs, utilizando Redis como cache.
 * Se o cache estiver frio, faz o scraping do Fundamentus.
 */
async function getAllFiis(): Promise<FundamentusFii[]> {
  const cached = await redis.get<FundamentusFii[]>(CACHE_KEY)
  if (cached && Array.isArray(cached) && cached.length > 0) return cached

  const fiis = await fetchFundamentusFiis()

  await redis.set(CACHE_KEY, fiis, { ex: listTtl() })

  return fiis
}

/**
 * Compara dois valores anuláveis para uso em Array.sort.
 * Valores null são sempre posicionados no fim, independentemente da direção.
 */
function compareValues(
  a: number | string | null,
  b: number | string | null,
  order: 'asc' | 'desc',
): number {
  // Nulos sempre vão pro fim
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1

  let result: number
  if (typeof a === 'string' && typeof b === 'string') {
    result = a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
  } else {
    result = (a as number) < (b as number) ? -1 : (a as number) > (b as number) ? 1 : 0
  }

  return order === 'desc' ? -result : result
}

// ----------------------------------------------------------------
// Service principal
// ----------------------------------------------------------------

/**
 * Lista FIIs com filtro, ordenação e paginação.
 *
 * Fluxo:
 *  1. Carrega lista completa do cache Redis (ou faz scraping)
 *  2. Aplica filtros (search, segmento)
 *  3. Ordena pelo campo solicitado
 *  4. Pagina com limit/page
 *  5. Retorna resultado + metadados de paginação + segmentos disponíveis
 */
export async function listFiis(query: FiiListQuery): Promise<FiiListResponse> {
  const { search, segmento, sortBy, sortOrder, limit, page } = query

  // 1. Lista bruta
  const all = await getAllFiis()

  // 2. Extrai segmentos únicos antes de filtrar (para o front popular o filtro)
  const segmentos = Array.from(
    new Set(all.map((f) => f.segmento).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'))

  // 3. Aplica filtros
  let filtered = all as FiiItem[]

  if (search) {
    const q = search.toUpperCase()
    filtered = filtered.filter(
      (f) =>
        f.papel.toUpperCase().includes(q) ||
        f.segmento.toUpperCase().includes(q),
    )
  }

  if (segmento) {
    const seg = segmento.toLowerCase()
    filtered = filtered.filter((f) => f.segmento.toLowerCase() === seg)
  }

  // 4. Ordena
  const field = sortBy ?? 'papel'
  filtered = [...filtered].sort((a, b) =>
    compareValues(
      a[field as keyof FiiItem] as number | string | null,
      b[field as keyof FiiItem] as number | string | null,
      sortOrder ?? 'asc',
    ),
  )

  // 5. Paginação
  const totalCount = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalCount / limit))
  const safePage = Math.min(page, totalPages)
  const offset = (safePage - 1) * limit
  const pageItems = filtered.slice(offset, offset + limit)

  return {
    fiis: pageItems,
    currentPage: safePage,
    totalPages,
    totalCount,
    hasNextPage: safePage < totalPages,
    segmentos,
  }
}

/**
 * Retorna os dados de um único FII pelo ticker.
 * Utiliza o mesmo cache da listagem.
 */
export async function getFii(papel: string): Promise<FiiItem | null> {
  const all = await getAllFiis()
  return all.find((f) => f.papel.toUpperCase() === papel.toUpperCase()) ?? null
}
