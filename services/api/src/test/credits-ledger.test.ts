import assert from 'node:assert/strict'
import { CreditLedgerEntryKind, CreditTopupOrderStatus, Prisma } from '@prisma/client'
import { after, beforeEach, test } from 'node:test'
import { prisma } from '../lib/prisma'
import {
  createTestUser,
  cleanupTestData,
} from './testUtils'
import {
  createCreditTopupOrder,
  getCreditBalance,
  listCreditLedger,
  markCreditTopupOrderPaid,
  recordCreditDebit,
} from '../modules/credits/credits.service'

beforeEach(async () => {
  await cleanupTestData()
})

after(async () => {
  await cleanupTestData()
  await prisma.$disconnect()
  setImmediate(() => process.exit(process.exitCode ?? 0))
})

test('credits-ledger.spec: cria ordem pendente e credita saldo ao marcar pagamento', async () => {
  const user = await createTestUser({ name: 'Credits User' })

  const order = await createCreditTopupOrder({
    userId: user.id,
    amount: 10,
    stripeCheckoutSessionId: 'cs_test_credit_topup_1',
  })

  assert.equal(order.status, CreditTopupOrderStatus.PENDING)

  const paid = await markCreditTopupOrderPaid({
    orderId: order.id,
    stripePaymentIntentId: 'pi_test_credit_topup_1',
  })

  assert.equal(paid.order.status, CreditTopupOrderStatus.PAID)
  assert.equal(paid.ledgerEntry?.kind, CreditLedgerEntryKind.CREDIT)
  assert.equal(new Prisma.Decimal(paid.balance.balance).toFixed(2), '10.00')

  const balance = await getCreditBalance(user.id)
  assert.equal(new Prisma.Decimal(balance.balance).toFixed(2), '10.00')

  const secondPaidAttempt = await markCreditTopupOrderPaid({ orderId: order.id })
  assert.equal(new Prisma.Decimal(secondPaidAttempt.balance.balance).toFixed(2), '10.00')

  const ledger = await listCreditLedger(user.id)
  assert.equal(ledger.length, 1)
})

test('credits-ledger.spec: registra debito e bloqueia saldo insuficiente', async () => {
  const user = await createTestUser({ name: 'Debit User' })

  const order = await createCreditTopupOrder({
    userId: user.id,
    amount: 5,
    stripeCheckoutSessionId: 'cs_test_credit_topup_2',
  })
  await markCreditTopupOrderPaid({ orderId: order.id })

  const debit = await recordCreditDebit({
    userId: user.id,
    amount: 1.5,
    description: 'Desbloqueio de análise reaproveitada',
    metadata: { ticker: 'MXRF11' },
  })

  assert.equal(debit.ledgerEntry.kind, CreditLedgerEntryKind.DEBIT)
  assert.equal(new Prisma.Decimal(debit.balance.balance).toFixed(2), '3.50')

  await assert.rejects(
    () =>
      recordCreditDebit({
        userId: user.id,
        amount: 9,
        description: 'Tentativa acima do saldo',
      }),
    (error: unknown) => {
      const err = error as Error & { statusCode?: number }
      assert.equal(err.message, 'INSUFFICIENT_CREDITS')
      assert.equal(err.statusCode, 409)
      return true
    },
  )

  const ledger = await listCreditLedger(user.id)
  assert.equal(ledger.length, 2)
  assert.deepEqual(
    ledger.map((entry) => entry.kind).sort(),
    [CreditLedgerEntryKind.CREDIT, CreditLedgerEntryKind.DEBIT].sort(),
  )
})