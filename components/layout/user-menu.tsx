"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, KeyRound, LogOut, ShieldCheck, User } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { changeOwnPassword } from "@/app/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isAdminRole, ROLE_LABELS, type UserRole } from "@/lib/projects";

export function UserMenu({ role, name, email }: { role: UserRole; name: string | null; email: string | null }) {
  const [open, setOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const admin = isAdminRole(role);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-9 items-center gap-2 rounded-full border border-white/15 bg-white/5 pl-1.5 pr-2.5 text-sm transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-gold"
      >
        <span className={`flex size-6 items-center justify-center rounded-full ${admin ? "bg-gold text-teal-dark" : "bg-white/15"}`}>
          {admin ? <ShieldCheck className="size-3.5" /> : <User className="size-3.5" />}
        </span>
        <span className="hidden max-w-[10rem] truncate font-medium sm:inline">{admin ? name || email : "Invitado"}</span>
        <ChevronDown className="size-3.5 opacity-70" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-50 w-64 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl animate-in fade-in zoom-in-95"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-semibold">{admin ? name || "Administrador" : "Modo invitado"}</p>
            {email && <p className="truncate text-xs text-muted-foreground">{email}</p>}
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
              {admin && <ShieldCheck className="size-3" />} {ROLE_LABELS[role]}
            </span>
          </div>
          {admin && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setPwdOpen(true);
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted"
            >
              <KeyRound className="size-4 text-muted-foreground" /> Cambiar contraseña
            </button>
          )}
          <form action={logout}>
            <button type="submit" role="menuitem" className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-destructive hover:bg-muted">
              <LogOut className="size-4" /> Cerrar sesión
            </button>
          </form>
        </div>
      )}

      {admin && <ChangePasswordDialog open={pwdOpen} onOpenChange={setPwdOpen} />}
    </div>
  );
}

function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (pwd !== pwd2) return setMsg({ ok: false, text: "Las contraseñas no coinciden." });
    setBusy(true);
    const r = await changeOwnPassword(pwd);
    setBusy(false);
    if (r.ok) {
      setMsg({ ok: true, text: "Contraseña actualizada." });
      setPwd("");
      setPwd2("");
    } else setMsg({ ok: false, text: r.error });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setMsg(null);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cambiar contraseña</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-pwd">Nueva contraseña</Label>
            <Input id="new-pwd" type="password" autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-pwd2">Repítela</Label>
            <Input id="new-pwd2" type="password" autoComplete="new-password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
          {msg && <p className={`text-sm font-medium ${msg.ok ? "text-success" : "text-destructive"}`}>{msg.text}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button onClick={save} disabled={busy || !pwd}>
            {busy ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
