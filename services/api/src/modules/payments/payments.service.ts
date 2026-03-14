import Stripe from 'stripe'
import { stripe } from '../../lib/stripe'
import { prisma } from '../../lib/prisma'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'

// ---- Checkout ----

export async function createCheckoutSession(userId: string, priceId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true, stripeCustomerId: true },
  })

  // Reutiliza o customer existente ou cria um novo
  let customerId = user.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email })
    customerId = customer.id
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customerId },
    })
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    // Habilita cartão e PIX — configure no Stripe Dashboard em Payment Methods
    success_url: `${APP_URL}/dashboard?upgraded=true`,
    cancel_url: `${APP_URL}/dashboard/premium`,
    subscription_data: {
      metadata: { userId },
    },
  })

  return { url: session.url }
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

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode !== 'subscription') break

      const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
      const userId = subscription.metadata?.userId
      if (!userId) break

      const premiumPlan = await prisma.plan.findUniqueOrThrow({ where: { name: 'PREMIUM' } })

      // Calcula expiração com base no período da assinatura
      const periodEnd = new Date((subscription as unknown as { current_period_end: number }).current_period_end * 1000)

      await prisma.user.update({
        where: { id: userId },
        data: {
          planId: premiumPlan.id,
          planExpiresAt: periodEnd,
          stripeSubscriptionId: subscription.id,
        },
      })
      break
    }

    case 'invoice.paid': {
      // Renova a data de expiração a cada ciclo de cobrança
      const invoice = event.data.object as Stripe.Invoice
      // No Stripe v20 o campo subscription foi movido para parent.subscription_details
      const invoiceAny = invoice as unknown as Record<string, unknown>
      const subId: string | null | undefined =
        (invoiceAny['subscription'] as string | null) ??
        ((invoiceAny['parent'] as Record<string, unknown> | null)?.['subscription_details'] as Record<string, unknown> | null)?.['subscription_id'] as string | null
      if (!subId) break

      const subscription = await stripe.subscriptions.retrieve(subId)
      const userId = subscription.metadata?.userId
      if (!userId) break

      const periodEnd = new Date((subscription as unknown as { current_period_end: number }).current_period_end * 1000)

      await prisma.user.update({
        where: { id: userId },
        data: { planExpiresAt: periodEnd },
      })
      break
    }

    case 'customer.subscription.deleted': {
      // Assinatura encerrada — reverte para FREE
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
      break
    }

    case 'invoice.payment_failed': {
      // Só loga — pode-se adicionar envio de e-mail aqui futuramente
      const invoice = event.data.object as Stripe.Invoice
      console.warn(`[payments] Falha no pagamento da fatura ${invoice.id}`)
      break
    }
  }
}
