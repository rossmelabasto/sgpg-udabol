"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, BookOpenText, FileSearch, Loader2, Lock, ShieldCheck } from "lucide-react";
import { signInAnonymously, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { loginAction } from "@/app/actions/auth";
import { auth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

// Vuelve a la página que se quería abrir (solo rutas internas).
function nextPath() {
  const n = new URLSearchParams(window.location.search).get("next");
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

const AUTH_ERRORS: Record<string, string> = {
  "auth/invalid-credential": "Correo o contraseña incorrectos.",
  "auth/wrong-password": "Correo o contraseña incorrectos.",
  "auth/user-not-found": "Correo o contraseña incorrectos.",
  "auth/invalid-email": "El correo no es válido.",
  "auth/too-many-requests": "Demasiados intentos. Espera unos minutos y vuelve a probar.",
  "auth/network-request-failed": "Sin conexión. Revisa tu internet.",
};

export default function IngresarPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"guest" | "admin" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function finish(res: { success: true } | { success: false; error: string }) {
    if (res.success) {
      router.replace(nextPath());
      router.refresh();
      return true;
    }
    setError(res.error);
    return false;
  }

  function handleGuest() {
    setMode("guest");
    setError(null);
    startTransition(async () => {
      try {
        const cred = await signInAnonymously(auth);
        finish(await loginAction({ idToken: await cred.user.getIdToken() }));
      } catch (err: any) {
        setError(AUTH_ERRORS[err?.code] ?? "No se pudo ingresar como invitado.");
      }
    });
  }

  function handleAdmin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMode("admin");
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    startTransition(async () => {
      try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        const ok = finish(await loginAction({ idToken: await cred.user.getIdToken() }));
        if (!ok) await signOut(auth).catch(() => {});
      } catch (err: any) {
        setError(AUTH_ERRORS[err?.code] ?? "No se pudo iniciar sesión.");
      }
    });
  }

  const busy = isPending;

  return (
    <main id="contenido" className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      {/* Panel institucional */}
      <section className="bg-institucional relative flex flex-col justify-between overflow-hidden px-6 py-8 text-sidebar-foreground sm:px-10 lg:px-14 lg:py-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandMark className="size-11" />
            <div className="leading-tight">
              <p className="font-heading text-xl font-semibold tracking-wide">UDABOL</p>
              <p className="text-[11px] uppercase tracking-[0.16em] opacity-70">Universidad de Aquino Bolivia</p>
            </div>
          </div>
          <ThemeToggle className="lg:hidden" />
        </div>

        <div className="my-10 max-w-lg lg:my-0">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-medium text-gold-light">
            <BookOpenText className="size-3.5" /> Repositorio institucional
          </p>
          <h1 className="font-heading text-4xl font-semibold leading-[1.1] sm:text-5xl">
            Proyectos de <span className="text-gold">Grado</span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/75 sm:text-lg">
            Consulta los proyectos y tesis de grado de la universidad: busca por tema, autor o carrera y lee el documento
            completo en línea.
          </p>
          <ul className="mt-8 hidden gap-3 text-sm text-white/80 sm:grid">
            <li className="flex items-center gap-3">
              <FileSearch className="size-5 text-gold" /> Búsqueda por título, tema, palabras clave y alumno
            </li>
            <li className="flex items-center gap-3">
              <BookOpenText className="size-5 text-gold" /> Visor de PDF integrado, también desde el celular
            </li>
            <li className="flex items-center gap-3">
              <ShieldCheck className="size-5 text-gold" /> Registro con historial de cambios y versiones
            </li>
          </ul>
        </div>

        <p className="hidden text-xs text-white/50 lg:block">Sistema de Gestión de Proyectos de Grado · SGPG</p>
      </section>

      {/* Acceso */}
      <section className="relative flex items-center justify-center bg-background px-4 py-10 sm:px-8">
        <ThemeToggle className="absolute right-6 top-6 hidden border-border bg-card text-foreground hover:bg-muted lg:flex" />
        <div className="w-full max-w-md">
          <h2 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">Bienvenido</h2>
          <p className="mt-1 text-sm text-muted-foreground">Elige cómo quieres ingresar.</p>

          <Button type="button" variant="gold" onClick={handleGuest} disabled={busy} className="mt-8 h-14 w-full justify-between rounded-xl px-5 text-base">
            <span className="flex items-center gap-3">
              <FileSearch className="size-5" />
              Consultar proyectos
            </span>
            {busy && mode === "guest" ? <Loader2 className="size-5 animate-spin" /> : <ArrowRight className="size-5" />}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">Acceso de solo lectura, sin cuenta.</p>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Personal autorizado
              </span>
            </div>
          </div>

          <form onSubmit={handleAdmin} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input id="email" name="email" type="email" autoComplete="username" placeholder="nombre@udabol.edu.bo" required className="h-11" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required className="h-11" />
            </div>

            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" disabled={busy} className="h-11 w-full rounded-lg text-sm font-semibold">
              {busy && mode === "admin" ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Ingresando…
                </>
              ) : (
                <>
                  <Lock className="size-4" /> Ingresar como administrador
                </>
              )}
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
