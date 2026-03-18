"use client";

import { FormProvider, useForm } from "react-hook-form";
import { Button, Card, Input, useToast } from "rharuow-ds";
import { useState } from "react";

type FormData = { email: string };

export function ForgotPasswordForm() {
  const methods = useForm<FormData>({ defaultValues: { email: "" } });
  const { register, formState: { isSubmitting } } = methods;
  const toast = useToast();
  const [sent, setSent] = useState(false);

  async function onSubmit(data: FormData) {
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Erro ao processar solicitação.");
        return;
      }
      setSent(true);
    } catch {
      toast.error("Erro ao conectar com o servidor.");
    }
  }

  if (sent) {
    return (
      <Card variant="elevated">
        <Card.Header>
          <h2 className="text-lg font-semibold">Verifique seu e-mail</h2>
        </Card.Header>
        <Card.Body>
          <p className="text-sm">
            Se esse e-mail estiver cadastrado, você receberá as instruções para
            redefinir sua senha em breve. Não esqueça de verificar a caixa de spam.
          </p>
          <div className="mt-5">
            <a
              href="/login"
              className="text-sm font-medium hover:underline"
            >
              ← Voltar ao login
            </a>
          </div>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card variant="elevated">
      <Card.Header>
        <h2 className="text-lg font-semibold">Esqueceu a senha?</h2>
        <p className="text-sm text-slate-500">
          Informe seu e-mail e enviaremos um link para redefinir sua senha.
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

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Enviando…" : "Enviar link de redefinição"}
            </Button>
          </form>
        </FormProvider>

        <div className="mt-5 text-center">
          <a
            href="/login"
            className="text-xs hover:underline"
          >
            ← Voltar ao login
          </a>
        </div>
      </Card.Body>
    </Card>
  );
}
