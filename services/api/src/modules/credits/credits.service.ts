import {
  CreditLedgerEntryKind,
  CreditTopupOrderStatus,
  Prisma,
} from '@prisma/client'
import { prisma } from '../../lib/prisma'

type DbClient = Prisma.TransactionClient | typeof prisma

type JsonValue = Prisma.InputJsonValue

function serviceError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode })
}

function toDecimal(value: Prisma.Decimal | number | string) {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value)
}

async function getOrCreateBalance(userId: string, db: DbClient) {
  const existing = await db.userCreditBalance.findUnique({ where: { userId } })

  if (existing) {
    return existing
  }

  return db.userCreditBalance.create({
    data: {
      userId,
      balance: new Prisma.Decimal(0),
    },
  })
}

export async function getCreditBalance(userId: string) {
  return getOrCreateBalance(userId, prisma)
}

export async function createCreditTopupOrder(input: {
  userId: string
  amount: Prisma.Decimal | number | string
  stripeCheckoutSessionId?: string
  metadata?: JsonValue
}) {
  const amount = toDecimal(input.amount)

  if (amount.lte(0)) {
    throw serviceError('INVALID_TOPUP_AMOUNT', 400)
  }

  return prisma.creditTopupOrder.create({
    data: {
      userId: input.userId,
      amount,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId,
      metadata: input.metadata,
    },
  })
}

export async function markCreditTopupOrderPaid(input: {
  orderId: string
  stripePaymentIntentId?: string
  metadata?: JsonValue
}) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.creditTopupOrder.findUnique({ where: { id: input.orderId } })

    if (!order) {
      throw serviceError('TOPUP_ORDER_NOT_FOUND', 404)
    }

    if (order.status === CreditTopupOrderStatus.PAID) {
      const balance = await getOrCreateBalance(order.userId, tx)
      const ledgerEntry = await tx.creditLedgerEntry.findFirst({
        where: { topupOrderId: order.id, kind: CreditLedgerEntryKind.CREDIT },
        orderBy: { createdAt: 'asc' },
      })

      return { order, balance, ledgerEntry }
    }

    if (order.status !== CreditTopupOrderStatus.PENDING) {
      throw serviceError('TOPUP_ORDER_NOT_PAYABLE', 409)
    }

    const balance = await getOrCreateBalance(order.userId, tx)
    const nextBalance = new Prisma.Decimal(balance.balance).add(order.amount)

    const updatedBalance = await tx.userCreditBalance.update({
      where: { userId: order.userId },
      data: { balance: nextBalance },
    })

    const updatedOrder = await tx.creditTopupOrder.update({
      where: { id: order.id },
      data: {
        status: CreditTopupOrderStatus.PAID,
        stripePaymentIntentId: input.stripePaymentIntentId ?? order.stripePaymentIntentId,
        paidAt: new Date(),
        ...(input.metadata !== undefined
          ? { metadata: input.metadata }
          : order.metadata != null
            ? { metadata: order.metadata as Prisma.InputJsonValue }
            : {}),
      },
    })

    const ledgerEntry = await tx.creditLedgerEntry.create({
      data: {
        userId: order.userId,
        topupOrderId: order.id,
        kind: CreditLedgerEntryKind.CREDIT,
        amount: order.amount,
        balanceAfter: nextBalance,
        description: 'Recarga aprovada',
        metadata: input.metadata,
      },
    })

    return {
      order: updatedOrder,
      balance: updatedBalance,
      ledgerEntry,
    }
  })
}

export async function recordCreditDebit(input: {
  userId: string
  amount: Prisma.Decimal | number | string
  description: string
  metadata?: JsonValue
}) {
  const amount = toDecimal(input.amount)

  if (amount.lte(0)) {
    throw serviceError('INVALID_DEBIT_AMOUNT', 400)
  }

  return prisma.$transaction(async (tx) => {
    const balance = await getOrCreateBalance(input.userId, tx)

    if (new Prisma.Decimal(balance.balance).lt(amount)) {
      throw serviceError('INSUFFICIENT_CREDITS', 409)
    }

    const nextBalance = new Prisma.Decimal(balance.balance).sub(amount)

    const updatedBalance = await tx.userCreditBalance.update({
      where: { userId: input.userId },
      data: { balance: nextBalance },
    })

    const ledgerEntry = await tx.creditLedgerEntry.create({
      data: {
        userId: input.userId,
        kind: CreditLedgerEntryKind.DEBIT,
        amount,
        balanceAfter: nextBalance,
        description: input.description,
        metadata: input.metadata,
      },
    })

    return {
      balance: updatedBalance,
      ledgerEntry,
    }
  })
}

export async function listCreditLedger(userId: string) {
  await getOrCreateBalance(userId, prisma)

  return prisma.creditLedgerEntry.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })
}