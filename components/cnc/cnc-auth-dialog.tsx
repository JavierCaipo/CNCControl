"use client";

import * as React from "react";
import { KeyRound, Mail, Eye, EyeOff, Loader2, AlertTriangle, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Operator {
  id: string;
  name: string;
  role: string;
  organizationId: string | null;
}

interface CncAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  tenantName: string;
  onSuccess: (user: { id: string; name: string; role: string; email: string | null }) => void;
}

export function CncAuthDialog({
  open,
  onOpenChange,
  slug,
  tenantName,
  onSuccess,
}: CncAuthDialogProps) {
  const [tab, setTab] = React.useState<"pin" | "manager">("pin");

  // PIN Form State
  const [operators, setOperators] = React.useState<Operator[]>([]);
  const [loadingOperators, setLoadingOperators] = React.useState(false);
  const [selectedUserId, setSelectedUserId] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [pinError, setPinError] = React.useState<string | null>(null);
  const [isPinLoggingIn, setIsPinLoggingIn] = React.useState(false);

  // Manager Form State
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [managerError, setManagerError] = React.useState<string | null>(null);
  const [isManagerLoggingIn, setIsManagerLoggingIn] = React.useState(false);

  // Load operators when dialog opens
  React.useEffect(() => {
    if (!open) return;
    let isMounted = true;

    async function loadOperators() {
      try {
        setLoadingOperators(true);
        const res = await fetch(`/api/auth/operators?org=${encodeURIComponent(slug)}`);
        if (res.ok && isMounted) {
          const data = await res.json();
          setOperators(data.operators || []);
          if (data.operators?.length > 0 && !selectedUserId) {
            setSelectedUserId(data.operators[0].id);
          }
        }
      } catch (err) {
        console.error("Error al cargar operarios:", err);
      } finally {
        if (isMounted) setLoadingOperators(false);
      }
    }

    loadOperators();

    return () => {
      isMounted = false;
    };
  }, [open, slug, selectedUserId]);

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !pin) {
      setPinError("Selecciona tu nombre e ingresa el PIN.");
      return;
    }

    setPinError(null);
    setIsPinLoggingIn(true);

    try {
      const res = await fetch("/api/auth/login-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, pin }),
      });

      const data = await res.json();
      if (!res.ok) {
        setPinError(data.error || "PIN incorrecto.");
        setIsPinLoggingIn(false);
        return;
      }

      onSuccess(data.user);
      onOpenChange(false);
      setPin("");
    } catch {
      setPinError("Error de conexión al verificar el PIN.");
    } finally {
      setIsPinLoggingIn(false);
    }
  };

  const handleManagerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setManagerError("Ingresa tu correo y contraseña.");
      return;
    }

    setManagerError(null);
    setIsManagerLoggingIn(true);

    try {
      const res = await fetch("/api/auth/login-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setManagerError(data.error || "Credenciales inválidas.");
        setIsManagerLoggingIn(false);
        return;
      }

      onSuccess(data.user);
      onOpenChange(false);
      setPassword("");
    } catch {
      setManagerError("Error de conexión al iniciar sesión.");
    } finally {
      setIsManagerLoggingIn(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border bg-card shadow-2xl">
        <DialogHeader className="text-center sm:text-left">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="size-4" />
            </div>
            <DialogTitle className="text-lg font-bold">Identificación de Usuario</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Acceso a la consola operativa de <strong className="text-foreground">{tenantName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "pin" | "manager")} className="w-full mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pin" className="gap-2 text-xs">
              <KeyRound className="size-3.5" />
              <span>Planta (PIN)</span>
            </TabsTrigger>
            <TabsTrigger value="manager" className="gap-2 text-xs">
              <Mail className="size-3.5" />
              <span>Gerencia (Email)</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: PLANTA (PIN) */}
          <TabsContent value="pin" className="pt-4 space-y-4">
            <form onSubmit={handlePinLogin} className="space-y-4">
              {pinError && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/15 border border-destructive/30 p-2.5 text-xs text-destructive">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>{pinError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="pin-operator-select" className="text-xs">
                  Operador / Supervisor
                </Label>
                {loadingOperators ? (
                  <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Cargando equipo de planta...</span>
                  </div>
                ) : operators.length === 0 ? (
                  <p className="text-xs text-amber-400 py-1">
                    No hay operarios registrados en esta organización. Ingresa como Gerente para crearlos.
                  </p>
                ) : (
                  <Select value={selectedUserId} onValueChange={(val) => setSelectedUserId(val)}>
                    <SelectTrigger id="pin-operator-select" className="w-full text-sm">
                      <SelectValue placeholder="Selecciona tu nombre..." />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map((op) => (
                        <SelectItem key={op.id} value={op.id}>
                          {op.name} ({op.role === "supervisor" ? "Supervisor" : "Operario"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pin-input" className="text-xs">
                  PIN de Acceso (4 a 6 dígitos)
                </Label>
                <Input
                  id="pin-input"
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  autoFocus
                  required
                  className="font-mono tracking-widest text-lg text-center"
                />
              </div>

              <Button
                type="submit"
                disabled={isPinLoggingIn || operators.length === 0}
                className="w-full mt-2"
              >
                {isPinLoggingIn ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Verificando PIN...
                  </>
                ) : (
                  "Iniciar Sesión en Planta"
                )}
              </Button>
            </form>
          </TabsContent>

          {/* TAB 2: GERENCIA (EMAIL) */}
          <TabsContent value="manager" className="pt-4 space-y-4">
            <form onSubmit={handleManagerLogin} className="space-y-4">
              {managerError && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/15 border border-destructive/30 p-2.5 text-xs text-destructive">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>{managerError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="manager-email" className="text-xs">
                  Correo Electrónico
                </Label>
                <Input
                  id="manager-email"
                  type="email"
                  placeholder="gerencia@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="manager-password" className="text-xs">
                  Contraseña
                </Label>
                <div className="relative">
                  <Input
                    id="manager-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" disabled={isManagerLoggingIn} className="w-full mt-2">
                {isManagerLoggingIn ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Iniciando sesión...
                  </>
                ) : (
                  "Acceder como Gerente"
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
