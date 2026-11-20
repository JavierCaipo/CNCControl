"use client";

import * as React from "react";
import { Users, UserPlus, KeyRound, AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TeamUser {
  id: string;
  name: string;
  role: string;
  email: string | null;
  active: boolean;
  createdAt: string;
}

interface CncTeamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantName: string;
}

export function CncTeamModal({ open, onOpenChange, tenantName }: CncTeamModalProps) {
  const [team, setTeam] = React.useState<TeamUser[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [showCreateForm, setShowCreateForm] = React.useState(false);

  // Create form state
  const [newName, setNewName] = React.useState("");
  const [newRole, setNewRole] = React.useState<"operario" | "supervisor">("operario");
  const [newPin, setNewPin] = React.useState("");
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);

  // Change PIN modal state
  const [pinChangeUser, setPinChangeUser] = React.useState<TeamUser | null>(null);
  const [updatedPin, setUpdatedPin] = React.useState("");
  const [pinChangeError, setPinChangeError] = React.useState<string | null>(null);
  const [isUpdatingPin, setIsUpdatingPin] = React.useState(false);

  const loadTeam = React.useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setTeam(data.users || []);
      }
    } catch (err) {
      console.error("Error al cargar equipo:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let isMounted = true;
    if (open) {
      (async () => {
        try {
          const res = await fetch("/api/users");
          if (res.ok && isMounted) {
            const data = await res.json();
            setTeam(data.users || []);
          }
        } catch (err) {
          console.error("Error al cargar equipo:", err);
        } finally {
          if (isMounted) setLoading(false);
        }
      })();
    }
    return () => {
      isMounted = false;
    };
  }, [open]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPin.trim()) {
      setCreateError("Ingresa el nombre y un PIN de 4 a 6 dígitos.");
      return;
    }

    setCreateError(null);
    setIsCreating(true);

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          role: newRole,
          pin: newPin.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "Error al crear el usuario.");
        setIsCreating(false);
        return;
      }

      setNewName("");
      setNewPin("");
      setNewRole("operario");
      setShowCreateForm(false);
      loadTeam();
    } catch {
      setCreateError("Error de red al registrar el usuario.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleActive = async (user: TeamUser) => {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !user.active }),
      });

      if (res.ok) {
        loadTeam();
      }
    } catch (err) {
      console.error("Error al actualizar usuario:", err);
    }
  };

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinChangeUser || !updatedPin.trim()) return;

    setPinChangeError(null);
    setIsUpdatingPin(true);

    try {
      const res = await fetch(`/api/users/${pinChangeUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: updatedPin.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setPinChangeError(data.error || "Error al actualizar el PIN.");
        setIsUpdatingPin(false);
        return;
      }

      setPinChangeUser(null);
      setUpdatedPin("");
    } catch {
      setPinChangeError("Error de red al cambiar el PIN.");
    } finally {
      setIsUpdatingPin(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Users className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">Equipo y Perfiles</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Administración de operarios y supervisores autorizados para {tenantName}.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-sm font-medium">Personal Registrado</span>
              {!showCreateForm && (
                <Button size="sm" onClick={() => setShowCreateForm(true)} className="gap-1.5">
                  <UserPlus className="size-4" />
                  <span>Nuevo Operario</span>
                </Button>
              )}
            </div>

            {/* Create User Form */}
            {showCreateForm && (
              <form
                onSubmit={handleCreateUser}
                className="rounded-lg border border-border/80 bg-muted/20 p-4 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-primary">Crear Personal de Planta</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCreateForm(false)}
                    className="h-7 text-xs"
                  >
                    Cancelar
                  </Button>
                </div>

                {createError && (
                  <div className="flex items-center gap-2 rounded-lg bg-destructive/15 border border-destructive/30 p-2.5 text-xs text-destructive">
                    <AlertTriangle className="size-4 shrink-0" />
                    <span>{createError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5 sm:col-span-1">
                    <Label htmlFor="user-name" className="text-xs">
                      Nombre Completo *
                    </Label>
                    <Input
                      id="user-name"
                      placeholder="Ej. Juan Pérez"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="user-role" className="text-xs">
                      Rol
                    </Label>
                    <Select
                      value={newRole}
                      onValueChange={(val: "operario" | "supervisor") => setNewRole(val)}
                    >
                      <SelectTrigger id="user-role" className="w-full text-xs">
                        <SelectValue placeholder="Selecciona un rol" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="operario">Operario</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="user-pin" className="text-xs">
                      PIN Inicial (4-6 dígitos) *
                    </Label>
                    <Input
                      id="user-pin"
                      type="password"
                      inputMode="numeric"
                      maxLength={8}
                      placeholder="••••"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreateForm(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" size="sm" disabled={isCreating} className="gap-2">
                    {isCreating ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                    <span>Registrar</span>
                  </Button>
                </div>
              </form>
            )}

            {/* Team Table */}
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead>Nombre</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right">PIN</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-xs text-muted-foreground">
                        Cargando equipo...
                      </TableCell>
                    </TableRow>
                  ) : team.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-xs text-muted-foreground">
                        No hay usuarios registrados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    team.map((user) => (
                      <TableRow key={user.id} className="border-border hover:bg-muted/30">
                        <TableCell>
                          <div className="font-medium text-sm">{user.name}</div>
                          {user.email && (
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              user.role === "gerente"
                                ? "default"
                                : user.role === "supervisor"
                                ? "secondary"
                                : "outline"
                            }
                            className="capitalize text-xs"
                          >
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {user.role !== "gerente" ? (
                            <div className="flex items-center justify-center gap-2">
                              <Switch
                                checked={user.active}
                                onCheckedChange={() => handleToggleActive(user)}
                              />
                              <span className="text-xs text-muted-foreground min-w-[45px]">
                                {user.active ? "Activo" : "Inactivo"}
                              </span>
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              Principal
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {user.role !== "gerente" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setPinChangeUser(user);
                                setUpdatedPin("");
                                setPinChangeError(null);
                              }}
                              className="h-8 text-xs gap-1"
                            >
                              <KeyRound className="size-3.5" />
                              <span>Cambiar PIN</span>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change PIN Dialog */}
      <Dialog open={!!pinChangeUser} onOpenChange={(open) => !open && setPinChangeUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <KeyRound className="size-4 text-primary" />
              <span>Cambiar PIN de Acceso</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Asigna un nuevo PIN para <strong className="text-foreground">{pinChangeUser?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdatePin} className="space-y-4 pt-1">
            {pinChangeError && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/15 border border-destructive/30 p-2 text-xs text-destructive">
                <AlertTriangle className="size-3.5 shrink-0" />
                <span>{pinChangeError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="update-pin-input" className="text-xs">
                Nuevo PIN (4 a 6 dígitos)
              </Label>
              <Input
                id="update-pin-input"
                type="password"
                inputMode="numeric"
                maxLength={8}
                placeholder="••••"
                value={updatedPin}
                onChange={(e) => setUpdatedPin(e.target.value.replace(/\D/g, ""))}
                autoFocus
                required
                className="font-mono text-center tracking-widest text-lg"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setPinChangeUser(null)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={isUpdatingPin}>
                {isUpdatingPin ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
                <span>Guardar PIN</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
