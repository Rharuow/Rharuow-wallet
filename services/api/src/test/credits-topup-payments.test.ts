import assert from 'node:assert/strict'
import { Prisma } from '@prisma/client'
import { after, beforeEach, test } from 'node:test'
import Stripe from 'stripe'
import { prisma } from '../lib/prisma'
import { getCreditBalance, listCreditLedger } from '../modules/credits/credits.service'
import {
  createCreditTopupCheckoutSession,
  handleStripeEvent,
} from '../modules/payments/payments.service'
import { cleanupTestData, createTestUser } from './testUtils'

beforeEach(async () => {
  await cleanupTestData()
})

after(async () => {
  await cleanupTestData()
  await prisma.$disconnect()
  setImmediate(() => process.exit(process.exitCode ?? 0))
})

test('credits-topup-payments.spec: cria checkout de recarga e credita saldo via webhook idempotente', async () => {
  const user = await createTestUser({ name: 'Topup User' })

  const fakeStripe = {
    customers: {
      create: async () => ({ id: 'cus_test_credit_topup' }),
    },
    checkout: {
      sessions: {
        create: async () => ({
          id: 'cs_test_credit_topup_checkout',
          url: 'https://stripe.test/checkout/credit-topup',
        }),
      },
    },
    subscriptions: {
      retrieve: async () => {
        throw new Error('subscriptions.retrieve should not be called in this test')
      },
    },
    webhooks: {
      constructEvent: () => {
        throw new Error('webhooks.constructEvent should not be called in this test')
      },
    },
  } as unknown as Pick<typeof import('../lib/stripe').stripe, 'checkout' | 'customers' | 'subscriptions' | 'webhooks'>

  const checkout = await createCreditTopupCheckoutSession(user.id, 12.5, fakeStripe)

  assert.equal(checkout.order.status, 'PENDING')
  assert.equal(checkout.checkoutSessionId, 'cs_test_credit_topup_checkout')
  assert.equal(checkout.checkoutUrl, 'https://stripe.test/checkout/credit-topup')

  const completedEvent = {
    id: 'evt_credit_topup_paid',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_credit_topup_checkout',
        mode: 'payment',
        payment_status: 'paid',
        payment_intent: 'pi_test_credit_topup_checkout',
        client_reference_id: checkout.order.id,
        metadata: {
          kind: 'CREDIT_TOPUP',
          topupOrderId: checkout.order.id,
          userId: user.id,
        },
      },
    },
  } as unknown as Stripe.Event

  await handleStripeEvent(completedEvent, fakeStripe)
  await handleStripeEvent(completedEvent, fakeStripe)

  const balance = await getCreditBalance(user.id)
  assert.equal(new Prisma.Decimal(balance.balance).toFixed(2), '12.50')

  const ledger = await listCreditLedger(user.id)
  assert.equal(ledger.length, 1)
  assert.equal(new Prisma.Decimal(ledger[0].amount).toFixed(2), '12.50')
})