"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button, Field, Input, PasswordInput } from "@/components/ui";

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
    <AuthShell title="Entrar no painel">
      <form onSubmit={onSubmit} className="mt-5 grid gap-3">
        <Field label="E-mail" error={error ?? undefined}>
          <Input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
          />
        </Field>
        <Field label="Senha">
          <PasswordInput
            required
            minLength={8}
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
          />
        </Field>
        <div className="text-right">
          <Link href="/forgot" className="link text-xs">
            Esqueci minha senha
          </Link>
        </div>
        <Button type="submit" loading={busy} className="w-full">
          {busy ? "Entrando…" : "Entrar"}
        </Button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-faint">
        <span className="h-px flex-1 bg-line" />
        ou
        <span className="h-px flex-1 bg-line" />
      </div>
      <Button variant="secondary" onClick={() => signIn("google", { callbackUrl })} className="w-full">
        Continuar com Google
      </Button>

      <p className="mt-5 text-center text-sm text-muted">
        Não tem conta?{" "}
        <Link href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="link">
          Criar conta
        </Link>
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
