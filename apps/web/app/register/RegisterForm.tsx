"use client";

import { FormProvider, useForm } from "react-hook-form";
import { Button, Card, Input, useToast } from "rharuow-ds";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";

type RegisterFormData = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type RegisterFormProps = {
  initialEmail?: string;
  initialSubmitted?: boolean;
  initialVerificationContext?: "registration" | "inactive-login";
};

export function RegisterForm({
  initialEmail = "",
  initialSubmitted = false,
  initialVerificationContext = "registration",
}: RegisterFormProps) {
  const methods = useForm<RegisterFormData>({
    defaultValues: {
      name: "",
      email: initialEmail,
      password: "",
      confirmPassword: "",
    },
  });

  const {
    register,
    watch,
    formState: { isSubmitting },
  } = methods;

  const router = useRouter();
  const toast = useToast();
  const [submitted, setSubmitted] = useState(initialSubmitted);
  const [registeredEmail, setRegisteredEmail] = useState(initialEmail);
  const [verificationEmailSent, setVerificationEmailSent] = useState(true);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);
  const [verificationContext, setVerificationContext] = useState<
    "registration" | "inactive-login"
  >(initialVerificationContext);
  const hasTriggeredInitialResend = useRef(false);

  async function onSubmit(data: RegisterFormData) {
    try {
      const normalizedEmail = data.email.trim().toLowerCase();
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: normalizedEmail,
          password: data.password,
        }),
      });

      const body = await res.json();

      if (!res.ok) {
        toast.error(body.error ?? "Erro ao criar conta");
        return;
      }

      setRegisteredEmail(normalizedEmail);
      setVerificationEmailSent(body.verificationEmailSent ?? true);
      setVerificationContext("registration");
      setSubmitted(true);
    } catch {
      toast.error("Erro ao conectar com o servidor");
    }
  }

  const startResendCooldown = useEffectEvent(() => {
    setResendCooldownSeconds(60);
  });

  const handleResendVerificationEmail = useEffectEvent(async (options?: {
    automatic?: boolean;
  }) => {
    if (!registeredEmail || isResendingEmail || resendCooldownSeconds > 0) {
      return;
    }

    try {
      setIsResendingEmail(true);

      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: registeredEmail }),
      });

      const body = await res.json();

      if (!res.ok) {
        toast.error(body.error ?? "Não foi possível reenviar o e-mail");
        return;
      }

      startResendCooldown();
      setVerificationEmailSent(true);

      if (options?.automatic) {
        toast.success(
          body.message ?? "Reenviamos automaticamente um novo e-mail de confirmação."
        );
      } else {
        toast.success(body.message ?? "Se necessário, um novo e-mail foi enviado.");
      }
    } catch {
      toast.error("Erro ao conectar com o servidor");
    } finally {
      setIsResendingEmail(false);
    }
  });

  useEffect(() => {
    if (resendCooldownSeconds <= 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setResendCooldownSeconds((currentSeconds) => currentSeconds - 1);
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [resendCooldownSeconds]);

  useEffect(() => {
    if (
      verificationContext !== "inactive-login" ||
      !submitted ||
      !registeredEmail ||
      hasTriggeredInitialResend.current
    ) {
      return;
    }

    hasTriggeredInitialResend.current = true;
    toast.info("Sua conta ainda não foi confirmada. Estamos reenviando um novo link agora.");
    void handleResendVerificationEmail({ automatic: true });
  }, [handleResendVerificationEmail, registeredEmail, submitted, toast, verificationContext]);

  const resendButtonLabel = isResendingEmail
    ? "Reenviando..."
    : resendCooldownSeconds > 0
      ? `Reenviar em ${resendCooldownSeconds}s`
      : "Reenviar e-mail de confirmação";

  if (submitted) {
    return (
      <Card variant="elevated">
        <Card.Header>
          <h2 className="text-lg font-semibold">Verifique seu e-mail</h2>
        </Card.Header>
        <Card.Body>
          {verificationContext === "inactive-login" && (
            <p className="text-sm text-amber-700">
              Sua conta existe, mas ainda não foi confirmada. Reenvie o link abaixo para ativá-la.
            </p>
          )}
          <p className="text-sm">
            Enviamos um link de confirmação para{" "}
            <strong>{registeredEmail}</strong>.
          </p>
          {!verificationEmailSent && (
            <p className="mt-2 text-sm text-amber-700">
              Não conseguimos confirmar o envio agora. Sua conta foi criada e você pode solicitar um novo link abaixo.
            </p>
          )}
          <p className="mt-2 text-sm">
            Clique no link do e-mail para ativar sua conta e então faça login.
          </p>
          <Button
            className="mt-6 w-full"
            variant="outline"
            onClick={() => void handleResendVerificationEmail()}
            disabled={isResendingEmail || resendCooldownSeconds > 0}
          >
            {resendButtonLabel}
          </Button>
          <Button
            className="mt-3 w-full"
            variant="outline"
            onClick={() => router.push("/login")}
          >
            Ir para o login
          </Button>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card variant="elevated">
      <Card.Header>
        <h2 className="text-lg font-semibold">Criar conta</h2>
        <p className="text-sm text-slate-500">
          Preencha os dados abaixo para se cadastrar
        </p>
      </Card.Header>

      <Card.Body>
        <FormProvider {...methods}>
          <form
            onSubmit={methods.handleSubmit(onSubmit)}
            className="flex flex-col gap-5"
            noValidate
          >
            <Input
              label="Nome"
              type="text"
              autoComplete="name"
              {...register("name", {
                required: "Nome é obrigatório",
                minLength: { value: 2, message: "Mínimo 2 caracteres" },
              })}
            />

            <Input
              label="E-mail"
              type="email"
              autoComplete="email"
              {...register("email", {
                required: "E-mail é obrigatório",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Informe um e-mail válido",
                },
              })}
            />

            <div className="flex flex-col gap-1">
            <Input
              label="Senha"
              type="password"
              autoComplete="new-password"
              {...register("password", {
                required: "Senha é obrigatória",
                minLength: { value: 8, message: "Mínimo 8 caracteres" },
                validate: {
                  hasUppercase: (v) =>
                    /[A-Z]/.test(v) || "Deve conter ao menos uma letra maiúscula",
                  hasNumber: (v) =>
                    /[0-9]/.test(v) || "Deve conter ao menos um número",
                },
              })}
            />
            <p className="text-xs text-slate-400">
              A senha deve ter pelo menos <strong>8 caracteres</strong>, incluir{" "}
              <strong>uma letra maiúscula</strong> e <strong>um número</strong>.
            </p>
            </div>

            <Input
              label="Confirmar senha"
              type="password"
              autoComplete="new-password"
              {...register("confirmPassword", {
                required: "Confirmação obrigatória",
                validate: (v) =>
                  v === watch("password") || "As senhas não coincidem",
              })}
            />

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Criando conta..." : "Criar conta"}
            </Button>
          </form>
        </FormProvider>
      </Card.Body>
    </Card>
  );
}
