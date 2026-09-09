"use client";

import { Suspense, useActionState, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Check } from "lucide-react";
import { registerUser, type AuthActionResult } from "@/server/auth/actions";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field, Input, PasswordInput, Button } from "@/components/ui";
import { safeInternalPath } from "@/lib/safe-redirect";

function RegisterForm() {
  const params = useSearchParams();
  // Manual navigation after signIn(redirect: false) — sanitise to block open redirects.
  const callbackUrl = safeInternalPath(params.get("callbackUrl"), "/onboarding");
  const [state, action, pending] = useActionState<AuthActionResult | null, FormData>(registerUser, null);
  const [signingIn, setSigningIn] = useState(false);
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];

  // On successful registration, sign the user in with the same credentials.
  useEffect(() => {
    if (!state?.ok || !state.email) return;
    const form = document.getElementById("register-form") as HTMLFormElement | null;
    const password = (form?.elements.namedItem("password") as HTMLInputElement | null)?.value;
    if (!password) return;
    setSigningIn(true);
    signIn("credentials", { email: state.email, password, redirect: false }).then((res) => {
      // Full-page navigation so the new session cookie is attached to the next
      // request (a soft router.push can race the cookie and bounce to /login).
      window.location.assign(res?.error ? "/login" : callbackUrl);
    });
  }, [state, callbackUrl]);

  if (state?.ok) {
    return (
      <div className="mt-5">
        <span className="grid size-10 place-items-center rounded-full bg-success-bg text-success">
          <Check className="size-5" aria-hidden />
        </span>
        <p className="mt-3 text-sm text-muted">
          Conta criada! Enviamos um e-mail de confirmação para{" "}
          <span className="font-medium text-ink">{state.email}</span>.{" "}
          {signingIn ? "Entrando…" : "Você já pode continuar."}
        </p>
      </div>
    );
  }

  return (
    <>
      <form id="register-form" action={action} className="mt-5 grid gap-3">
        <Field label="Nome" required error={err("name")}>
          <Input name="name" required autoComplete="name" maxLength={120} />
        </Field>
        <Field label="E-mail" required error={err("email")}>
          <Input name="email" type="email" required autoComplete="email" maxLength={160} />
        </Field>
        <Field label="Senha" required error={err("password")} hint="Mínimo de 8 caracteres.">
          <PasswordInput name="password" required minLength={8} autoComplete="new-password" />
        </Field>
        <Field label="Confirmar senha" required error={err("confirm")}>
          <PasswordInput name="confirm" required minLength={8} autoComplete="new-password" />
        </Field>
        {state?.error && (
          <p className="field-error" role="alert">
            {state.error}
          </p>
        )}
        <Button type="submit" loading={pending} className="w-full">
          {pending ? "Criando…" : "Criar conta"}
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
        Já tem conta?{" "}
        <Link href="/login" className="link">
          Entrar
        </Link>
      </p>
    </>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <AuthShell title="Criar conta">
        <RegisterForm />
      </AuthShell>
    </Suspense>
  );
}
