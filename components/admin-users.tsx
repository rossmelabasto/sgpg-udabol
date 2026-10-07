"use client";

import { useEffect, useState } from "react";
import { Crown, Loader2, Pencil, Shield, ShieldOff, Trash2, UserPlus } from "lucide-react";
import { addAdminUser, getAdminUsers, removeAdminUser, toggleAdminStatus, updateAdminUser, type AdminUser } from "@/app/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatDateTime } from "@/components/project-history";

type Role = "admin" | "superadmin";
const ROLE_TEXT: Record<Role, string> = { admin: "Administrador", superadmin: "Superadministrador" };

export function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "admin" as Role });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [removing, setRemoving] = useState<AdminUser | null>(null);

  async function load() {
    setUsers(await getAdminUsers());
  }
  useEffect(() => {
    getAdminUsers().then(setUsers);
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setAdding(true);
    const r = await addAdminUser({ email: form.email, displayName: form.name, password: form.password, role: form.role });
    setAdding(false);
    if (!r.ok) return setError(r.error);
    setNotice(`Cuenta creada para ${form.email}. Pásale la contraseña por un medio seguro y pídele que la cambie al entrar.`);
    setForm({ email: "", name: "", password: "", role: "admin" });
    load();
  }

  async function handleToggle(u: AdminUser) {
    const r = await toggleAdminStatus(u.id, !u.isActive);
    if (!r.ok) setError(r.error);
    load();
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleAdd} className="rounded-xl border border-border bg-muted/30 p-4 sm:p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
          <UserPlus className="size-4" /> Nueva cuenta administrativa
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-email">Correo</Label>
            <Input id="new-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nombre@udabol.edu.bo" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-name">Nombre</Label>
            <Input id="new-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Jefatura de Sistemas" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-password">Contraseña inicial</Label>
            <Input id="new-password" type="text" autoComplete="off" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 8 caracteres" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Rol</Label>
            <Select value={form.role} onValueChange={(v) => v && setForm({ ...form, role: v as Role })}>
              <SelectTrigger className="w-full">
                <SelectValue>{(v: string) => ROLE_TEXT[v as Role]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="superadmin">Superadministrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Administrador: registra, edita y envía a la papelera. Superadministrador: además gestiona cuentas, borra definitivamente y usa «Sistema».
        </p>
        <Button type="submit" disabled={adding} className="mt-4">
          {adding ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />} Crear cuenta
        </Button>
      </form>

      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {notice && <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{notice}</p>}

      {!users ? (
        <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
      ) : (
        <ul className="flex flex-col gap-2">
          {users.map((u) => (
            <li key={u.id} className={`flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center ${u.isActive ? "" : "opacity-60"}`}>
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${u.role === "superadmin" ? "bg-gold text-teal-dark" : "bg-secondary text-secondary-foreground"}`}>
                {u.role === "superadmin" ? <Crown className="size-4" /> : <Shield className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                  {u.displayName}
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">{ROLE_TEXT[u.role]}</span>
                  {!u.isActive && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">Desactivada</span>}
                </p>
                <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                <p className="text-xs text-muted-foreground">
                  {u.lastSignIn ? `Último ingreso: ${formatDateTime(new Date(u.lastSignIn).toISOString())}` : "Nunca ingresó"}
                  {u.addedBy && ` · agregada por ${u.addedBy}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="sm" onClick={() => setEditing(u)} title="Editar">
                  <Pencil className="size-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleToggle(u)} title={u.isActive ? "Desactivar (le corta el acceso)" : "Reactivar"}>
                  {u.isActive ? <ShieldOff className="size-4" /> : <Shield className="size-4 text-success" />}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setRemoving(u)} title="Quitar">
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && <EditDialog key={editing.id} user={editing} onClose={() => setEditing(null)} onSaved={load} />}

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="¿Quitar esta cuenta administrativa?"
        description={`${removing?.email} perderá el acceso de inmediato. La cuenta queda en Firebase Auth pero sin permisos.`}
        confirmLabel="Quitar acceso"
        destructive
        onConfirm={async () => {
          if (!removing) return;
          const r = await removeAdminUser(removing.id);
          if (!r.ok) setError(r.error);
          load();
        }}
      />
    </div>
  );
}

function EditDialog({ user, onClose, onSaved }: { user: AdminUser; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(user.displayName);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(user.role);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const r = await updateAdminUser(user.id, { displayName: name, email, password: password || undefined, role });
    setSaving(false);
    if (!r.ok) return setError(r.error);
    onSaved();
    onClose();
  }

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar cuenta</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-name">Nombre</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-email">Correo</Label>
            <Input id="edit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-password">Nueva contraseña</Label>
            <Input id="edit-password" type="text" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Dejar vacío para no cambiarla" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Rol</Label>
            <Select value={role} onValueChange={(v) => v && setRole(v as Role)}>
              <SelectTrigger className="w-full">
                <SelectValue>{(v: string) => ROLE_TEXT[v as Role]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="superadmin">Superadministrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />} Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
