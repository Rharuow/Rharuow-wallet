/**
 * fundamentusClient
 *
 * Faz scraping da tabela de FIIs do Fundamentus.com.br
 * (/fii_resultado.php) e retorna os dados parseados.
 *
 * Colunas da tabela (índice → campo):
 *  0  papel          - Ticker (ex: MXRF11)
 *  1  segmento       - Segmento do FII
 *  2  cotacao        - Cotação atual (R$)
 *  3  ffoYield       - FFO Yield (%)
 *  4  dividendYield  - Dividend Yield (%)
 *  5  pvp            - P/VP
 *  6  valorMercado   - Valor de Mercado (R$)
 *  7  liquidez       - Liquidez média diária (R$)
 *  8  qtdImoveis     - Quantidade de imóveis
 *  9  precoM2        - Preço por m² (R$)
 * 10  aluguelM2      - Aluguel por m² (R$)
 * 11  capRate        - Cap Rate (%)
 * 12  vacanciaMedia  - Vacância Média (%)
 */

import { parse } from 'node-html-parser'

export const FUNDAMENTUS_FII_URL =
  'https://www.fundamentus.com.br/fii_resultado.php'

export interface FundamentusFii {
  papel: string
  segmento: string
  cotacao: number | null
  ffoYield: number | null
  dividendYield: number | null
  pvp: number | null
  valorMercado: number | null
  liquidez: number | null
  qtdImoveis: number | null
  precoM2: number | null
  aluguelM2: number | null
  capRate: number | null
  vacanciaMedia: number | null
}

/** Converte string brasileira de número para float.
 *  Exemplos:
 *    "8,19"         → 8.19
 *    "196.865.000"  → 196865000
 *    "12,79%"       → 12.79
 *    "0,00"         → 0
 *    "-"            → null
 */
function parseBR(raw: string): number | null {
  if (!raw || raw.trim() === '-' || raw.trim() === '') return null

  // Remove "%" e espaços
  const cleaned = raw.replace(/%/g, '').trim()

  // O padrão brasileiro usa "." como separador de milhar e "," como decimal
  // Se houver vírgula, trocamos pela lógica correta:
  //   - Remove pontos de milhar, converte vírgula decimal → ponto
  const hasComma = cleaned.includes(',')
  const hasDot = cleaned.includes('.')

  let normalized: string
  if (hasComma) {
    // "1.234,56" → remove pontos → "1234,56" → troca vírgula → "1234.56"
    normalized = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (hasDot) {
    // "196.865.000" (sem vírgula) → pontos são separadores de milhar → remove-os
    // Mas "1.5" sem vírgula seria ambíguo; na tabela do Fundamentus sempre é milhar
    normalized = cleaned.replace(/\./g, '')
  } else {
    normalized = cleaned
  }

  const n = parseFloat(normalized)
  return isNaN(n) ? null : n
}

/**
 * Busca e parseia a tabela completa de FIIs do Fundamentus.
 * Lança erro se a requisição ou o parse falhar.
 */
export async function fetchFundamentusFiis(): Promise<FundamentusFii[]> {
  const response = await fetch(FUNDAMENTUS_FII_URL, {
    headers: {
      // Necessário para evitar bloqueio por user-agent padrão do Node.js fetch
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
  })

  if (!response.ok) {
    throw new Error(
      `Fundamentus fetch error: ${response.status} ${response.statusText}`,
    )
  }

  // O Fundamentus serve o HTML em ISO-8859-1.
  // response.text() decodifica como UTF-8 por padrão, corrompendo acentos.
  // Lemos como ArrayBuffer e decodificamos explicitamente com latin1.
  const buffer = await response.arrayBuffer()
  const html = new TextDecoder('iso-8859-1').decode(buffer)
  const root = parse(html)

  // A tabela principal de resultados tem id="tabelaResultado"
  const table = root.querySelector('#tabelaResultado')
  if (!table) {
    throw new Error('Fundamentus: tabela #tabelaResultado não encontrada no HTML')
  }

  const rows = table.querySelectorAll('tbody tr')

  const fiis: FundamentusFii[] = []

  for (const row of rows) {
    const cells = row.querySelectorAll('td')
    if (cells.length < 13) continue

    const getText = (i: number) => cells[i].text.trim()

    const fii: FundamentusFii = {
      papel: getText(0),
      segmento: getText(1),
      cotacao: parseBR(getText(2)),
      ffoYield: parseBR(getText(3)),
      dividendYield: parseBR(getText(4)),
      pvp: parseBR(getText(5)),
      valorMercado: parseBR(getText(6)),
      liquidez: parseBR(getText(7)),
      qtdImoveis: parseBR(getText(8)),
      precoM2: parseBR(getText(9)),
      aluguelM2: parseBR(getText(10)),
      capRate: parseBR(getText(11)),
      vacanciaMedia: parseBR(getText(12)),
    }

    // Ignora linhas sem ticker (cabeçalho extra ou linhas vazias)
    if (!fii.papel || fii.papel.length < 4) continue

    fiis.push(fii)
  }

  return fiis
}
