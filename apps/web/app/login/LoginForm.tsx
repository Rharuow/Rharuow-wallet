"use client";

import { FormProvider, useForm } from "react-hook-form";
import { Button, Card, Input, useToast } from "rharuow-ds";
import { useRouter } from "next/navigation";

type LoginFormData = {
  email: string;
  password: string;
};

export function LoginForm({ nextPath }: { nextPath?: string | null }) {
  const methods = useForm<LoginFormData>({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const {
    register,
    formState: { isSubmitting },
  } = methods;

  const router = useRouter();
  const toast = useToast();

  async function onSubmit(data: LoginFormData) {
    try {
      const normalizedEmail = data.email.trim().toLowerCase();
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          email: normalizedEmail,
        }),
      });

      const body = await res.json();

      if (!res.ok) {
        if (res.status === 403) {
          const params = new URLSearchParams({
            email: normalizedEmail,
            pendingVerification: "1",
            source: "login",
          });
          router.push(`/register?${params.toString()}`);
          return;
        }

        toast.error(body.error ?? "Credenciais inválidas");
        return;
      }

      router.push(nextPath || "/dashboard");
    } catch {
      toast.error("Erro ao conectar com o servidor");
    }
  }

  return (
    <Card variant="elevated">
      <Card.Header>
        <h2 className="text-lg font-semibold">Entrar na sua conta</h2>
        <p className="text-sm text-slate-500">
          Informe seu e-mail e senha para continuar
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

            <Input
              label="Senha"
              type="password"
              autoComplete="current-password"
              {...register("password", {
                required: "Senha é obrigatória",
                minLength: {
                  value: 6,
                  message: "A senha deve ter pelo menos 6 caracteres",
                },
              })}
            />

            <div className="flex justify-end">
              <a
                href="/forgot-password"
                className="text-xs hover:underline"
              >
                Esqueceu a senha?
              </a>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </FormProvider>
      </Card.Body>
    </Card>
  );
}

