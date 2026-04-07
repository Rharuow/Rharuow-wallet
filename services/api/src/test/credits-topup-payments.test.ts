import assert from 'node:assert/strict'
import { Prisma } from '@prisma/client'
import { after, beforeEach, test } from 'node:test'
import Stripe from 'stripe'
import { prisma } from '../lib/prisma'
import { getCreditBalance, listCreditLedger } from '../modules/credits/credits.service'
import {
  activateFromSession,
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

test('credits-topup-payments.spec: ativa recarga a partir da session no retorno do checkout', async () => {
  const user = await createTestUser({ name: 'Topup Activate User' })

  const fakeStripe = {
    customers: {
      create: async () => ({ id: 'cus_test_credit_topup_activate' }),
    },
    checkout: {
      sessions: {
        create: async () => ({
          id: 'cs_test_credit_topup_activate',
          url: 'https://stripe.test/checkout/credit-topup-activate',
        }),
        retrieve: async () => ({
          id: 'cs_test_credit_topup_activate',
          status: 'complete',
          mode: 'payment',
          payment_status: 'paid',
          customer: 'cus_test_credit_topup_activate',
          payment_intent: 'pi_test_credit_topup_activate',
          metadata: {
            kind: 'CREDIT_TOPUP',
            userId: user.id,
            topupOrderId: createdCheckout.order.id,
          },
          client_reference_id: createdCheckout.order.id,
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

  const createdCheckout = await createCreditTopupCheckoutSession(user.id, 18, fakeStripe)
  const activation = await activateFromSession(user.id, createdCheckout.checkoutSessionId, fakeStripe)

  assert.equal(activation.kind, 'CREDIT_TOPUP')
  assert.equal(activation.credited, true)

  const balance = await getCreditBalance(user.id)
  assert.equal(new Prisma.Decimal(balance.balance).toFixed(2), '18.00')

  const ledger = await listCreditLedger(user.id)
  assert.equal(ledger.length, 1)
  assert.equal(new Prisma.Decimal(ledger[0].amount).toFixed(2), '18.00')
})

test('credits-topup-payments.spec: propaga mensagem e status de falha do checkout Stripe', async () => {
  const user = await createTestUser({ name: 'Topup Error User' })
  let checkoutAttemptCount = 0

  const fakeStripe = {
    customers: {
      create: async () => ({ id: 'cus_test_credit_topup_error' }),
    },
    checkout: {
      sessions: {
        create: async (payload: { payment_method_types?: string[] }) => {
          checkoutAttemptCount += 1

          if (checkoutAttemptCount === 1) {
            assert.deepEqual(payload.payment_method_types, ['card', 'pix'])
            throw Object.assign(new Error('PIX indisponivel para esta conta Stripe'), {
              rawStatusCode: 400,
              code: 'payment_method_unavailable',
              type: 'StripeInvalidRequestError',
            })
          }

          assert.deepEqual(payload.payment_method_types, ['card'])
          return {
            id: 'cs_test_credit_topup_checkout_fallback',
            url: 'https://stripe.test/checkout/credit-topup-card-only',
          }
        },
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

  const checkout = await createCreditTopupCheckoutSession(user.id, 50, fakeStripe)

  assert.equal(checkoutAttemptCount, 2)
  assert.equal(checkout.checkoutSessionId, 'cs_test_credit_topup_checkout_fallback')
  assert.equal(checkout.checkoutUrl, 'https://stripe.test/checkout/credit-topup-card-only')
})

test('credits-topup-payments.spec: mantém falha quando nao existe metodo alternativo configurado', async () => {
  const user = await createTestUser({ name: 'Topup Pix Only Error User' })
  const previousMethods = process.env.STRIPE_CREDIT_TOPUP_PAYMENT_METHOD_TYPES
  process.env.STRIPE_CREDIT_TOPUP_PAYMENT_METHOD_TYPES = 'pix'

  const fakeStripe = {
    customers: {
      create: async () => ({ id: 'cus_test_credit_topup_pix_only' }),
    },
    checkout: {
      sessions: {
        create: async () => {
          throw Object.assign(new Error('PIX indisponivel para esta conta Stripe'), {
            rawStatusCode: 400,
            code: 'payment_method_unavailable',
            type: 'StripeInvalidRequestError',
          })
        },
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

  try {
    await assert.rejects(
      () => createCreditTopupCheckoutSession(user.id, 50, fakeStripe),
      (error: unknown) => {
        const typedError = error as Error & { statusCode?: number }
        assert.equal(typedError.message, 'PIX indisponivel para esta conta Stripe')
        assert.equal(typedError.statusCode, 400)
        return true
      },
    )
  } finally {
    if (previousMethods === undefined) {
      delete process.env.STRIPE_CREDIT_TOPUP_PAYMENT_METHOD_TYPES
    } else {
      process.env.STRIPE_CREDIT_TOPUP_PAYMENT_METHOD_TYPES = previousMethods
    }
  }
})