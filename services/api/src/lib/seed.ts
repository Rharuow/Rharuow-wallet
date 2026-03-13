import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { fetchBrapiStocks } from './brapiStocksClient'

/**
 * Traduções conhecidas dos segmentos retornados pela brapi.
 * Usadas apenas como fallback ao inserir um segmento novo pela primeira vez.
 * Segmentos já existentes no banco nunca têm o namePt sobrescrito aqui,
 * preservando eventuais ajustes manuais.
 */
const PT_TRANSLATIONS: Record<string, string> = {
  'Communications':         'Comunicações',
  'Commercial Services':    'Serviços Comerciais',
  'Consumer Durables':      'Bens de Consumo Duráveis',
  'Consumer Non-Durables':  'Bens de Consumo não Duráveis',
  'Consumer Services':      'Serviços ao Consumidor',
  'Distribution Services':  'Serviços de Distribuição',
  'Electronic Technology':  'Tecnologia Eletrônica',
  'Energy Minerals':        'Minerais de Energia',
  'Finance':                'Finanças',
  'Health Services':        'Serviços de Saúde',
  'Health Technology':      'Tecnologia em Saúde',
  'Industrial Services':    'Serviços Industriais',
  'Miscellaneous':          'Diversos',
  'Non-Energy Minerals':    'Minerais não Energéticos',
  'Process Industries':     'Indústrias de Processo',
  'Producer Manufacturing': 'Manufatura',
  'Retail Trade':           'Comércio Varejista',
  'Technology Services':    'Serviços de Tecnologia',
  'Transportation':         'Transporte',
  'Utilities':              'Utilidades Públicas',
}

/**
 * Garante que a role Root existe e que o usuário default está criado.
 * Chamado automaticamente ao startar o servidor.
 */
export async function seed(logger?: { info: (msg: string) => void }) {
  const log = (msg: string) => logger?.info(msg) ?? console.info(msg)

  // --- Planos (FREE / PREMIUM) ---
  for (const name of ['FREE', 'PREMIUM'] as const) {
    await prisma.plan.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }
  log('[seed] Planos FREE e PREMIUM sincronizados.')

  const premiumPlan = await prisma.plan.findUniqueOrThrow({ where: { name: 'PREMIUM' } })

  // --- Root role ---
  let rootRole = await prisma.role.findUnique({ where: { name: 'Root' } })
  if (!rootRole) {
    rootRole = await prisma.role.create({ data: { name: 'Root' } })
    log('[seed] Role "Root" criada.')
  } else {
    log('[seed] Role "Root" já existe.')
  }

  // --- User role ---
  const userRole = await prisma.role.findUnique({ where: { name: 'User' } })
  if (!userRole) {
    await prisma.role.create({ data: { name: 'User' } })
    log('[seed] Role "User" criada.')
  } else {
    log('[seed] Role "User" já existe.')
  }

  // --- Usuário default ---
  const defaultEmail =
    process.env.DEFAULT_USER_EMAIL ?? 'rharuow@mail.com'
  const defaultPassword =
    process.env.DEFAULT_USER_PASSWORD ?? 'endx9zss.2250667'
  const defaultName = process.env.DEFAULT_USER_NAME ?? 'Admin'

  const existing = await prisma.user.findUnique({ where: { email: defaultEmail } })
  if (!existing) {
    const passwordHash = await bcrypt.hash(defaultPassword, 12)
    await prisma.user.create({
      data: {
        email: defaultEmail,
        name: defaultName,
        passwordHash,
        roleId: rootRole.id,
        isActive: true,
        // Usuário default é PREMIUM sem prazo de expiração
        planId: premiumPlan.id,
        planExpiresAt: null,
      },
    })
    log(`[seed] Usuário default "${defaultEmail}" criado com role Root e plano PREMIUM permanente.`)
  } else {
    // Garante que o usuário default existente tenha plano PREMIUM permanente
    if (existing.planId !== premiumPlan.id || existing.planExpiresAt !== null) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { planId: premiumPlan.id, planExpiresAt: null },
      })
      log(`[seed] Plano do usuário default "${defaultEmail}" atualizado para PREMIUM permanente.`)
    } else {
      log(`[seed] Usuário default "${defaultEmail}" já existe.`)
    }
  }

  // --- Segmentos de ações (sincronizados via brapi) ---
  try {
    // limit=1 é suficiente — só precisamos de availableSectors
    const { availableSectors } = await fetchBrapiStocks({ type: 'stock', limit: 1 })

    for (const nameEn of availableSectors) {
      await prisma.stockSegment.upsert({
        where: { nameEn },
        // Não sobrescreve tradução já existente no banco
        update: {},
        create: {
          nameEn,
          namePt: PT_TRANSLATIONS[nameEn] ?? nameEn,
        },
      })
    }

    log(`[seed] ${availableSectors.length} segmentos sincronizados a partir da brapi.`)
  } catch (err) {
    // Falha na brapi não deve impedir a inicialização do servidor
    log(`[seed] Aviso: não foi possível sincronizar segmentos via brapi — ${(err as Error).message}`)
  }

  // --- Áreas de custo globais (padrão do sistema) ---
  const DEFAULT_COST_AREAS = [
    'Alimentação',
    'Educação',
    'Lazer',
    'Conforto',
    'Saúde',
  ]

  for (const name of DEFAULT_COST_AREAS) {
    const exists = await prisma.costArea.findFirst({ where: { name, userId: null } })
    if (!exists) {
      await prisma.costArea.create({ data: { name, userId: null } })
    }
  }
  log(`[seed] ${DEFAULT_COST_AREAS.length} áreas de custo globais sincronizadas.`)
}
