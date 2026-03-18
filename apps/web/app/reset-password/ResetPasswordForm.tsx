"use client";

import { FormProvider, useForm } from "react-hook-form";
import { Button, Card, Input, useToast } from "rharuow-ds";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";

type FormData = { password: string; confirmPassword: string };

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const token = searchParams.get("token") ?? "";

  const methods = useForm<FormData>({
    defaultValues: { password: "", confirmPassword: "" },
  });
  const {
    register,
    watch,
    formState: { isSubmitting },
  } = methods;

  const [done, setDone] = useState(false);

  async function onSubmit(data: FormData) {
    if (!token) {
      toast.error("Token de redefinição ausente ou inválido.");
      return;
    }
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: data.password }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Erro ao redefinir senha.");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch {
      toast.error("Erro ao conectar com o servidor.");
    }
  }

  if (!token) {
    return (
      <Card variant="elevated">
        <Card.Header>
          <h2 className="text-lg font-semibold">Link inválido</h2>
        </Card.Header>
        <Card.Body>
          <p className="text-sm">
            Este link de redefinição de senha é inválido ou expirou. Solicite um novo.
          </p>
          <div className="mt-5">
            <a
              href="/forgot-password"
              className="text-sm font-medium hover:underline"
            >
              Solicitar novo link
            </a>
          </div>
        </Card.Body>
      </Card>
    );
  }

  if (done) {
    return (
      <Card variant="elevated">
        <Card.Header>
          <h2 className="text-lg font-semibold">Senha redefinida!</h2>
        </Card.Header>
        <Card.Body>
          <p className="text-sm">
            Sua senha foi atualizada com sucesso. Você será redirecionado para o login em instantes.
          </p>
          <div className="mt-5">
            <a
              href="/login"
              className="text-sm font-medium hover:underline"
            >
              Ir para o login
            </a>
          </div>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card variant="elevated">
      <Card.Header>
        <h2 className="text-lg font-semibold">Redefinir senha</h2>
        <p className="text-sm text-slate-500">
          Escolha uma nova senha para sua conta.
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
              label="Nova senha"
              type="password"
              autoComplete="new-password"
              {...register("password", {
                required: "Senha é obrigatória",
                minLength: { value: 8, message: "Mínimo de 8 caracteres" },
                pattern: {
                  value: /(?=.*[A-Z])(?=.*[0-9])/,
                  message: "Deve conter pelo menos uma maiúscula e um número",
                },
              })}
            />

            <Input
              label="Confirmar nova senha"
              type="password"
              autoComplete="new-password"
              {...register("confirmPassword", {
                required: "Confirmação é obrigatória",
                validate: (val) =>
                  val === watch("password") || "As senhas não coincidem",
              })}
            />

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Redefinindo…" : "Redefinir senha"}
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
