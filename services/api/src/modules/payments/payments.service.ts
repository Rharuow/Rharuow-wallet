import Stripe from 'stripe'
import { stripe } from '../../lib/stripe'
import { prisma } from '../../lib/prisma'
import { createCreditTopupOrder, markCreditTopupOrderPaid } from '../credits/credits.service'
import { syncWalletAccessPermissionsForUser } from '../wallet-sharing/wallet-sharing.service'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'
const MIN_CREDIT_TOPUP_AMOUNT = 3
const SUPPORTED_CREDIT_TOPUP_PAYMENT_METHOD_TYPES = ['card', 'pix'] as const

type StripeClient = Pick<typeof stripe, 'checkout' | 'customers' | 'subscriptions' | 'webhooks'>
type CreditTopupPaymentMethodType =
  Stripe.Checkout.SessionCreateParams.PaymentMethodType

function toStatusError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode })
}

function isStripeLikeError(error: unknown): error is {
  message?: string
  statusCode?: number
  rawStatusCode?: number
  code?: string
  type?: string
} {
  if (!error || typeof error !== 'object') {
    return false
  }

  return (
    'rawStatusCode' in error ||
    'statusCode' in error ||
    'code' in error ||
    'type' in error
  )
}

function toCheckoutCreationError(error: unknown) {
  if (!isStripeLikeError(error)) {
    return error
  }

  const statusCode = error.rawStatusCode ?? error.statusCode ?? 502
  const fallbackMessage = 'Nao foi possivel iniciar o checkout da recarga.'
  const rawMessage = typeof error.message === 'string' ? error.message.trim() : ''
  const message = rawMessage || fallbackMessage

  return toStatusError(message, statusCode)
}

function getCreditTopupPaymentMethodTypes(): CreditTopupPaymentMethodType[] {
  const raw = process.env.STRIPE_CREDIT_TOPUP_PAYMENT_METHOD_TYPES ?? 'card,pix'
  const methods = raw
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is (typeof SUPPORTED_CREDIT_TOPUP_PAYMENT_METHOD_TYPES)[number] =>
      SUPPORTED_CREDIT_TOPUP_PAYMENT_METHOD_TYPES.includes(
        value as (typeof SUPPORTED_CREDIT_TOPUP_PAYMENT_METHOD_TYPES)[number],
      ),
    )

  if (methods.length === 0) {
    return ['card']
  }

  return [...new Set(methods)]
}

function shouldRetryCreditTopupWithoutPix(
  error: unknown,
  paymentMethodTypes: CreditTopupPaymentMethodType[],
) {
  if (!paymentMethodTypes.includes('pix') || !isStripeLikeError(error)) {
    return false
  }

  const message = typeof error.message === 'string' ? error.message.toLowerCase() : ''

  return (
    error.code === 'payment_method_unavailable' ||
    message.includes('payment method type provided: pix is invalid') ||
    message.includes('pix is invalid') ||
    message.includes('pix indisponivel')
  )
}

async function createCreditTopupStripeCheckoutSession(
  stripeClient: StripeClient,
  customerId: string,
  orderId: string,
  userId: string,
  amount: number,
  unitAmount: number,
  paymentMethodTypes: CreditTopupPaymentMethodType[],
) {
  return stripeClient.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    client_reference_id: orderId,
    payment_method_types: paymentMethodTypes,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'brl',
          unit_amount: unitAmount,
          product_data: {
            name: `Recarga de creditos - R$ ${amount.toFixed(2)}`,
          },
        },
      },
    ],
    success_url: `${APP_URL}/dashboard/creditos?credit_topup=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/dashboard/creditos?credit_topup=cancelled`,
    metadata: {
      kind: 'CREDIT_TOPUP',
      userId,
      topupOrderId: orderId,
    },
    payment_intent_data: {
      metadata: {
        kind: 'CREDIT_TOPUP',
        userId,
        topupOrderId: orderId,
      },
    },
  })
}

async function ensureStripeCustomer(userId: string, stripeClient: StripeClient = stripe) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true, stripeCustomerId: true },
  })

  let customerId = user.stripeCustomerId
  if (!customerId) {
    const customer = await stripeClient.customers.create({ email: user.email })
    customerId = customer.id
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customerId },
    })
  }

  return { user, customerId }
}

// ---- Checkout ----

export async function createCheckoutSession(userId: string, priceId: string, stripeClient: StripeClient = stripe) {
  const { customerId } = await ensureStripeCustomer(userId, stripeClient)

  const session = await stripeClient.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    // Habilita cartão e PIX — configure no Stripe Dashboard em Payment Methods
    success_url: `${APP_URL}/dashboard/premium/ativado?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/dashboard/premium`,
    subscription_data: {
      metadata: { userId },
    },
  })

  return { url: session.url }
}

export async function createCreditTopupCheckoutSession(
  userId: string,
  amount: number,
  stripeClient: StripeClient = stripe,
) {
  if (amount < MIN_CREDIT_TOPUP_AMOUNT) {
    throw toStatusError('Valor minimo de recarga: R$ 3,00', 400)
  }

  const { customerId } = await ensureStripeCustomer(userId, stripeClient)
  const order = await createCreditTopupOrder({ userId, amount })
  const unitAmount = Math.round(amount * 100)
  const configuredPaymentMethodTypes = getCreditTopupPaymentMethodTypes()

  try {
    let session

    try {
      session = await createCreditTopupStripeCheckoutSession(
        stripeClient,
        customerId,
        order.id,
        userId,
        amount,
        unitAmount,
        configuredPaymentMethodTypes,
      )
    } catch (error) {
      const fallbackPaymentMethodTypes = configuredPaymentMethodTypes.filter(
        (paymentMethodType) => paymentMethodType !== 'pix',
      )

      if (
        fallbackPaymentMethodTypes.length > 0 &&
        shouldRetryCreditTopupWithoutPix(error, configuredPaymentMethodTypes)
      ) {
        console.warn('[payments] credit-topup-checkout-retrying-without-pix', {
          userId,
          orderId: order.id,
          originalPaymentMethodTypes: configuredPaymentMethodTypes,
          fallbackPaymentMethodTypes,
          reason: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
        })

        session = await createCreditTopupStripeCheckoutSession(
          stripeClient,
          customerId,
          order.id,
          userId,
          amount,
          unitAmount,
          fallbackPaymentMethodTypes,
        )
      } else {
        throw error
      }
    }

    const updatedOrder = await prisma.creditTopupOrder.update({
      where: { id: order.id },
      data: { stripeCheckoutSessionId: session.id },
    })

    return {
      order: updatedOrder,
      checkoutSessionId: session.id,
      checkoutUrl: session.url,
    }
  } catch (error) {
    await prisma.creditTopupOrder.update({
      where: { id: order.id },
      data: {
        status: 'FAILED',
        metadata: {
          stage: 'checkout_create',
          reason: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
        },
      },
    })
    throw toCheckoutCreationError(error)
  }
}

// ---- Cancelar assinatura ----

export async function cancelSubscription(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { stripeSubscriptionId: true },
  })

  if (!user.stripeSubscriptionId) {
    const err = new Error('Nenhuma assinatura ativa encontrada') as Error & { statusCode: number }
    err.statusCode = 400
    throw err
  }

  // Cancela no final do período já pago (não corta imediatamente)
  await stripe.subscriptions.update(user.stripeSubscriptionId, {
    cancel_at_period_end: true,
  })

  return { message: 'Assinatura será cancelada ao fim do período atual.' }
}

// ---- Status do plano ----

export async function getPaymentStatus(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      plan: { select: { name: true } },
      planExpiresAt: true,
      stripeSubscriptionId: true,
    },
  })

  let cancelAtPeriodEnd = false
  if (user.stripeSubscriptionId) {
    const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId)
    cancelAtPeriodEnd = sub.cancel_at_period_end
  }

  return {
    plan: user.plan?.name ?? 'FREE',
    planExpiresAt: user.planExpiresAt,
    cancelAtPeriodEnd,
  }
}

// ---- Ativação via session (fallback para dev sem webhook) ----

export async function activateFromSession(
  userId: string,
  sessionId: string,
  stripeClient: StripeClient = stripe,
) {
  const session = await stripeClient.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription'],
  })

  if (session.status !== 'complete') {
    const err = new Error('Sessão de checkout não concluída') as Error & { statusCode: number }
    err.statusCode = 400
    throw err
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { stripeCustomerId: true },
  })

  // Garante que a sessão pertence a este usuário
  if (session.customer !== user.stripeCustomerId) {
    const err = new Error('Sessão não corresponde ao usuário autenticado') as Error & { statusCode: number }
    err.statusCode = 403
    throw err
  }

  if (session.mode === 'payment' && session.metadata?.kind === 'CREDIT_TOPUP') {
    await handleCreditTopupCheckoutSessionCompleted(session, `manual-activate:${session.id}`)

    const balance = await prisma.userCreditBalance.findUnique({
      where: { userId },
      select: { balance: true, updatedAt: true },
    })

    return {
      kind: 'CREDIT_TOPUP',
      credited: session.payment_status === 'paid',
      balance,
    }
  }

  if (session.mode !== 'subscription' || !session.subscription) {
    const err = new Error('Sessão de checkout não suporta ativação manual') as Error & { statusCode: number }
    err.statusCode = 400
    throw err
  }

  const subscription = session.subscription as Stripe.Subscription
  const premiumPlan = await prisma.plan.findUniqueOrThrow({ where: { name: 'PREMIUM' } })
  const periodEnd = new Date(subscription.items.data[0].current_period_end * 1000)

  await prisma.user.update({
    where: { id: userId },
    data: {
      planId: premiumPlan.id,
      planExpiresAt: periodEnd,
      stripeSubscriptionId: subscription.id,
    },
  })

  await syncWalletAccessPermissionsForUser(userId)

  return { plan: 'PREMIUM', planExpiresAt: periodEnd }
}

async function handleCreditTopupCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  eventId: string,
) {
  const topupOrderId = session.metadata?.topupOrderId ?? session.client_reference_id

  if (!topupOrderId) {
    return
  }

  if (session.payment_status !== 'paid') {
    return
  }

  const order = await prisma.creditTopupOrder.findUnique({
    where: { id: topupOrderId },
    select: { id: true, stripeCheckoutSessionId: true },
  })

  if (!order) {
    return
  }

  if (order.stripeCheckoutSessionId && order.stripeCheckoutSessionId !== session.id) {
    const err = new Error('TOPUP_SESSION_MISMATCH') as Error & { statusCode: number }
    err.statusCode = 409
    throw err
  }

  await markCreditTopupOrderPaid({
    orderId: topupOrderId,
    stripePaymentIntentId:
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id,
    metadata: {
      stripeEventId: eventId,
      stripeSessionId: session.id,
    },
  })
}

export async function handleStripeEvent(event: Stripe.Event, stripeClient: StripeClient = stripe) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode === 'payment' && session.metadata?.kind === 'CREDIT_TOPUP') {
        await handleCreditTopupCheckoutSessionCompleted(session, event.id)
        break
      }

      if (session.mode !== 'subscription') {
        break
      }

      const subscription = await stripeClient.subscriptions.retrieve(session.subscription as string)
      const userId = subscription.metadata?.userId
      if (!userId) break

      const premiumPlan = await prisma.plan.findUniqueOrThrow({ where: { name: 'PREMIUM' } })

      const periodEnd = new Date(subscription.items.data[0].current_period_end * 1000)

      await prisma.user.update({
        where: { id: userId },
        data: {
          planId: premiumPlan.id,
          planExpiresAt: periodEnd,
          stripeSubscriptionId: subscription.id,
        },
      })
      await syncWalletAccessPermissionsForUser(userId)
      break
    }

    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode === 'payment' && session.metadata?.kind === 'CREDIT_TOPUP') {
        await handleCreditTopupCheckoutSessionCompleted(session, event.id)
      }
      break
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice
      const invoiceAny = invoice as unknown as Record<string, unknown>
      const subId: string | null | undefined =
        (invoiceAny['subscription'] as string | null) ??
        ((invoiceAny['parent'] as Record<string, unknown> | null)?.['subscription_details'] as Record<string, unknown> | null)?.['subscription_id'] as string | null
      if (!subId) break

      const subscription = await stripeClient.subscriptions.retrieve(subId)
      const userId = subscription.metadata?.userId
      if (!userId) break

      const periodEnd = new Date(subscription.items.data[0].current_period_end * 1000)

      await prisma.user.update({
        where: { id: userId },
        data: { planExpiresAt: periodEnd },
      })
      await syncWalletAccessPermissionsForUser(userId)
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const userId = subscription.metadata?.userId
      if (!userId) break

      const freePlan = await prisma.plan.findUnique({ where: { name: 'FREE' } })

      await prisma.user.update({
        where: { id: userId },
        data: {
          planId: freePlan?.id ?? null,
          planExpiresAt: null,
          stripeSubscriptionId: null,
        },
      })
      await syncWalletAccessPermissionsForUser(userId)
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      console.warn(`[payments] Falha no pagamento da fatura ${invoice.id}`)
      break
    }
  }
}

// ---- Webhook ----

export async function handleWebhook(rawBody: Buffer, signature: string) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch {
    const err = new Error('Webhook signature inválida') as Error & { statusCode: number }
    err.statusCode = 400
    throw err
  }

  await handleStripeEvent(event)
}
