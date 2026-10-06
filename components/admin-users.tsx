"use client";

import { useState, useEffect } from "react";
import { getAdminUsers, addAdminUser, removeAdminUser, toggleAdminStatus, updateAdminUser, type AdminUser } from "@/app/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { UserPlus, Trash2, Shield, ShieldOff, Pencil } from "lucide-react";

export function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    const result = await getAdminUsers();
    setUsers(result);
    setLoading(false);
  }

  async function handleAdd() {
    if (!email.trim() || !password.trim()) {
      setError("Email y contraseña son obligatorios");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    setError("");

    const result = await addAdminUser({ email: email.trim(), displayName: name.trim(), password });
    if (!result.ok) {
      setError(result.error);
    } else {
      setEmail("");
      setName("");
      setPassword("");
      await loadUsers();
    }
  }

  async function handleRemove(id: string) {
    if (!window.confirm("¿Quitar este administrador? Perderá el acceso de inmediato.")) return;
    const r = await removeAdminUser(id);
    if (!r.ok) setError(r.error);
    await loadUsers();
  }

  async function handleToggle(id: string, current: boolean) {
    const r = await toggleAdminStatus(id, !current);
    if (!r.ok) setError(r.error);
    await loadUsers();
  }

  function openEditModal(user: AdminUser) {
    setEditId(user.id);
    setEditName(user.displayName || "");
    setEditEmail(user.email || "");
    setEditPassword("");
    setEditError("");
    setEditOpen(true);
  }

  async function handleEditSave() {
    if (!editName.trim() && !editEmail.trim() && !editPassword.trim()) {
      setEditError("No hay cambios para guardar.");
      return;
    }
    if (editPassword && editPassword.length < 8) {
      setEditError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setEditSaving(true);
    setEditError("");
    const result = await updateAdminUser(editId, {
      displayName: editName.trim() || undefined,
      email: editEmail.trim() || undefined,
      password: editPassword.trim() || undefined,
    });
    setEditSaving(false);
    if (!result.ok) {
      setEditError(result.error);
    } else {
      setEditOpen(false);
      await loadUsers();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="size-5" />
          Administradores
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3 mb-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <Input placeholder="Email del nuevo admin" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input placeholder="Nombre (opcional)" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button onClick={handleAdd} className="self-start">
            <UserPlus className="size-4 mr-1" />
            Crear Administrador
          </Button>
        </div>
        {error && <p className="text-sm text-destructive mb-2">{error}</p>}
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay administradores registrados.</p>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="font-medium">{u.displayName}</p>
                  <p className="text-sm text-muted-foreground">{u.email}</p>
                  <p className="text-xs text-muted-foreground">Agregado: {new Date(u.addedAt).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openEditModal(u)} title="Editar administrador">
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleToggle(u.id, u.isActive)}
                    title={u.isActive ? "Desactivar administrador" : "Activar administrador"}
                  >
                    {u.isActive ? <Shield className="size-4 text-green-500" /> : <ShieldOff className="size-4 text-red-500" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleRemove(u.id)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Editar administrador</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-name">Nombre</Label>
                <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nombre del administrador" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-email">Email</Label>
                <Input id="edit-email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="correo@ejemplo.com" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-password">Nueva contraseña</Label>
                <Input id="edit-password" type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Dejar vacío para no cambiarla" />
              </div>
              {editError && <p className="text-sm text-destructive">{editError}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving}>Cancelar</Button>
              <Button onClick={handleEditSave} disabled={editSaving}>{editSaving ? "Guardando..." : "Guardar cambios"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
