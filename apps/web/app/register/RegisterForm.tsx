"use client";

import { FormProvider, useForm } from "react-hook-form";
import { Button, Card, Input, useToast } from "rharuow-ds";
import { useRouter } from "next/navigation";
import { useState } from "react";

type RegisterFormData = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export function RegisterForm() {
  const methods = useForm<RegisterFormData>({
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const {
    register,
    watch,
    formState: { isSubmitting },
  } = methods;

  const router = useRouter();
  const toast = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  async function onSubmit(data: RegisterFormData) {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
        }),
      });

      const body = await res.json();

      if (!res.ok) {
        toast.error(body.error ?? "Erro ao criar conta");
        return;
      }

      setRegisteredEmail(data.email);
      setSubmitted(true);
    } catch {
      toast.error("Erro ao conectar com o servidor");
    }
  }

  if (submitted) {
    return (
      <Card variant="elevated">
        <Card.Header>
          <h2 className="text-lg font-semibold">Verifique seu e-mail</h2>
        </Card.Header>
        <Card.Body>
          <p className="text-sm">
            Enviamos um link de confirmação para{" "}
            <strong>{registeredEmail}</strong>.
          </p>
          <p className="mt-2 text-sm">
            Clique no link do e-mail para ativar sua conta e então faça login.
          </p>
          <Button
            className="mt-6 w-full"
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
