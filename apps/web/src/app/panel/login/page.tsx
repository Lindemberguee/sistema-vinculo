"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button, Card, CardBody, Field, Input } from "@/components/ui";

function LoginForm() {
  const params = useSearchParams();
  // "/" is the panel home on the app.<domain> subdomain (the middleware rewrites
  // it to /panel). Do NOT use "/panel" here — the middleware would rewrite that
  // to /panel/panel and 404.
  const callbackUrl = params.get("callbackUrl") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) {
      setBusy(false);
      setError("E-mail ou senha inválidos.");
      return;
    }
    // Full-page navigation, not router.push: guarantees the fresh session
    // cookie is attached to the next request so the panel doesn't bounce
    // straight back to /login.
    window.location.assign(callbackUrl);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <div className="mb-6 flex items-center gap-2 text-sm font-semibold">
        <span className="grid size-6 place-items-center rounded-md bg-brand-600 text-white">♥</span>
        Plataforma de Doações
      </div>
      <Card>
        <CardBody>
          <h1 className="text-lg font-semibold">Entrar no painel</h1>
          <form onSubmit={onSubmit} className="mt-4 grid gap-3">
            <Field label="E-mail">
              <Input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Senha">
              <Input
                type="password"
                required
                minLength={8}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {error && <p className="field-error">{error}</p>}
            <div className="text-right">
              <Link href="/forgot" className="link text-xs">
                Esqueci minha senha
              </Link>
            </div>
            <Button type="submit" loading={busy} className="w-full">
              {busy ? "Entrando…" : "Entrar"}
            </Button>
          </form>
          <Button
            variant="secondary"
            onClick={() => signIn("google", { callbackUrl })}
            className="mt-3 w-full"
          >
            Continuar com Google
          </Button>
          <p className="mt-4 text-center text-sm text-muted">
            Não tem conta?{" "}
            <Link href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="link">
              Criar conta
            </Link>
          </p>
        </CardBody>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
