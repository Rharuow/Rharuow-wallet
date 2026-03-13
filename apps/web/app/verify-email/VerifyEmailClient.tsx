"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button, Card } from "rharuow-ds";

type Status = "loading" | "success" | "error";

export function VerifyEmailClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Token de verificação ausente.");
      return;
    }

    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = await res.json();
        if (res.ok) {
          setStatus("success");
          setMessage(body.message ?? "E-mail confirmado com sucesso!");
        } else {
          setStatus("error");
          setMessage(body.error ?? "Não foi possível confirmar seu e-mail.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Erro ao conectar com o servidor.");
      });
  }, [searchParams]);

  return (
    <Card variant="elevated">
      <Card.Header>
        <h2 className="text-lg font-semibold">
          {status === "loading" && "Verificando..."}
          {status === "success" && "E-mail confirmado!"}
          {status === "error" && "Falha na verificação"}
        </h2>
      </Card.Header>

      <Card.Body>
        {status === "loading" && (
          <p className="text-sm">
            Aguarde enquanto confirmamos seu e-mail...
          </p>
        )}

        {status === "success" && (
          <>
            <p className="text-sm">{message}</p>
            <Button
              className="mt-6 w-full"
              onClick={() => router.push("/login")}
            >
              Ir para o login
            </Button>
          </>
        )}

        {status === "error" && (
          <>
            <p className="text-sm text-red-500">{message}</p>
            <Button
              className="mt-6 w-full"
              variant="outline"
              onClick={() => router.push("/register")}
            >
              Voltar ao cadastro
            </Button>
          </>
        )}
      </Card.Body>
    </Card>
  );
}
