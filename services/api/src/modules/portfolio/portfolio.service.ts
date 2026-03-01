import { prisma } from '../../lib/prisma'

/**
 * Retorna todos os holdings do usuário (via contas vinculadas).
 * Será expandido com dados em tempo real da B3 na próxima fase.
 */
export async function getUserHoldings(userId: string) {
  return prisma.holding.findMany({
    where: {
      account: { userId },
    },
    include: {
      asset: true,
    },
    orderBy: {
      asset: { symbol: 'asc' },
    },
  })
}
