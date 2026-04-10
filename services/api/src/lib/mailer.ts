import nodemailer from 'nodemailer'
import { Resend } from 'resend'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'

function shouldSkipEmailDelivery() {
  return process.env.MAILER_DISABLE_SEND === 'true'
}

function buildEmailHtml(link: string) {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2>Bem-vindo ao RharouWallet!</h2>
      <p>Clique no botão abaixo para confirmar seu e-mail e ativar sua conta:</p>
      <p style="text-align:center;margin:32px 0">
        <a href="${link}"
           style="background:#6366f1;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600">
          Confirmar e-mail
        </a>
      </p>
      <p style="font-size:12px;color:#888">
        O link expira em 24 horas. Se você não criou uma conta, ignore este e-mail.
      </p>
      <p style="font-size:12px;color:#888">
        Ou copie e cole no navegador:<br/>
        <a href="${link}">${link}</a>
      </p>
    </div>
  `
}

async function sendViaResend(to: string, subject: string, html: string) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const from = process.env.RESEND_FROM ?? 'RharouWallet <onboarding@resend.dev>'
  const { error } = await resend.emails.send({ from, to, subject, html })
  if (error) throw new Error(`Resend error: ${error.message}`)
}

async function sendViaSmtp(to: string, subject: string, html: string) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'localhost',
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: process.env.SMTP_SECURE === 'true',
    auth:
      process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  })
  const from = process.env.SMTP_FROM ?? 'RharouWallet <no-reply@rharuowallet.com>'
  const info = await transporter.sendMail({
    from,
    to,
    subject,
    html,
    text: `Acesse o link para continuar: ${html.match(/href="([^"]+)"/)?.[1] ?? APP_URL}`,
  })

  const rejectedRecipients = [...(info.rejected ?? []), ...(info.pending ?? [])]
  if (rejectedRecipients.length > 0) {
    throw new Error(`SMTP rejected recipients: ${rejectedRecipients.join(', ')}`)
  }
}

export async function sendVerificationEmail(email: string, token: string) {
  const link = `${APP_URL}/verify-email?token=${token}`
  const subject = 'Confirme seu cadastro — RharouWallet'
  const html = buildEmailHtml(link)

  if (shouldSkipEmailDelivery()) return

  if (process.env.RESEND_API_KEY) {
    await sendViaResend(email, subject, html)
  } else {
    await sendViaSmtp(email, subject, html)
  }
}

function buildPasswordResetHtml(link: string) {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2>Redefinir senha — RharouWallet</h2>
      <p>Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo:</p>
      <p style="text-align:center;margin:32px 0">
        <a href="${link}"
           style="background:#6366f1;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600">
          Redefinir senha
        </a>
      </p>
      <p style="font-size:12px;color:#888">
        O link expira em 1 hora. Se você não solicitou, ignore este e-mail — sua senha não será alterada.
      </p>
      <p style="font-size:12px;color:#888">
        Ou copie e cole no navegador:<br/>
        <a href="${link}">${link}</a>
      </p>
    </div>
  `
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const link = `${APP_URL}/reset-password?token=${token}`
  const subject = 'Redefinição de senha — RharouWallet'
  const html = buildPasswordResetHtml(link)

  if (shouldSkipEmailDelivery()) return

  if (process.env.RESEND_API_KEY) {
    await sendViaResend(email, subject, html)
  } else {
    await sendViaSmtp(email, subject, html)
  }
}

function buildWalletInviteHtml(link: string, ownerName: string) {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2>Convite para carteira compartilhada — RharouWallet</h2>
      <p><strong>${ownerName}</strong> convidou você para acessar uma carteira compartilhada.</p>
      <p style="text-align:center;margin:32px 0">
        <a href="${link}"
           style="background:#2563eb;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600">
          Ver convite
        </a>
      </p>
      <p style="font-size:12px;color:#888">
        O link expira em 7 dias. Se você não esperava este convite, ignore este e-mail.
      </p>
      <p style="font-size:12px;color:#888">
        Ou copie e cole no navegador:<br/>
        <a href="${link}">${link}</a>
      </p>
    </div>
  `
}

export async function sendWalletInviteEmail(email: string, token: string, ownerName: string) {
  const link = `${APP_URL}/convites/${token}`
  const subject = 'Convite para carteira compartilhada — RharouWallet'
  const html = buildWalletInviteHtml(link, ownerName)

  if (shouldSkipEmailDelivery()) return

  if (process.env.RESEND_API_KEY) {
    await sendViaResend(email, subject, html)
  } else {
    await sendViaSmtp(email, subject, html)
  }
}
