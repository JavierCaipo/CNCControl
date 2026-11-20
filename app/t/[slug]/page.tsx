"use client";

import * as React from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Server,
  QrCode,
  ShieldCheck,
  Users,
  History,
  BookOpen,
  Plus,
  LogOut,
  LogIn,
  CheckCircle2,
  AlertOctagon,
  Clock,
  Loader2,
  Building2,
  Lock,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ReviewState,
  newInspection,
  getStatus,
  setCheck,
  addIncident,
  resolveIncident,
  verify,
  CheckValue,
  validateReviewQuality,
} from "@/lib/cnc-model";
import { CncAuthDialog } from "@/components/cnc/cnc-auth-dialog";
import { CncMachinesModal, Machine } from "@/components/cnc/cnc-machines-modal";
import { CncTeamModal } from "@/components/cnc/cnc-team-modal";
import { CncHistoryModal } from "@/components/cnc/cnc-history-modal";
import { CncGuideModal } from "@/components/cnc/cnc-guide-modal";
import { CncIncidentsModal } from "@/components/cnc/cnc-incidents-modal";
import { CncChecklist } from "@/components/cnc/cnc-checklist";

interface TenantData {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  plan: string;
  maxMachines: number;
  active: boolean;
}

interface CurrentUser {
  id: string;
  name: string;
  role: string;
  email: string | null;
  organizationId?: string | null;
  organizationSlug?: string | null;
}

interface ReviewRecord {
  id: string;
  date: string;
  startedAt: string;
  operator: string;
  ot: string;
  shift: string;
  checks: Record<string, { value: "ok" | "fault" | "pending"; note: string }>;
  incidents: Array<{
    id: string;
    text: string;
    resolvedAt: string | null;
    responsible?: string;
    resolution?: string;
  }>;
  notes: string;
  verifiedAt: string | null;
}

function TenantConsoleContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = String(params?.slug || "").toLowerCase().trim();
  const qrMachineCode = searchParams.get("machine")?.toUpperCase().trim() || null;

  // Tenant & Machines state
  const [tenant, setTenant] = React.useState<TenantData | null>(null);
  const [tenantError, setTenantError] = React.useState<string | null>(null);
  const [loadingTenant, setLoadingTenant] = React.useState(true);
  const [machines, setMachines] = React.useState<Machine[]>([]);
  const [selectedMachine, setSelectedMachine] = React.useState<Machine | null>(null);
  const [detectedByQr, setDetectedByQr] = React.useState(false);

  // User session state
  const [currentUser, setCurrentUser] = React.useState<CurrentUser | null>(null);
  const [authDialogOpen, setAuthDialogOpen] = React.useState(false);

  // Modals state
  const [machinesModalOpen, setMachinesModalOpen] = React.useState(false);
  const [teamModalOpen, setTeamModalOpen] = React.useState(false);
  const [historyModalOpen, setHistoryModalOpen] = React.useState(false);
  const [guideModalOpen, setGuideModalOpen] = React.useState(false);
  const [incidentsModalOpen, setIncidentsModalOpen] = React.useState(false);

  // Operational review state
  const [review, setReview] = React.useState<ReviewState>(() => newInspection());
  const [historyList, setHistoryList] = React.useState<ReviewRecord[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<string | null>(null);

  // Shift closing state
  const [isClosingShift, setIsClosingShift] = React.useState(false);
  const [qualityValidationErrors, setQualityValidationErrors] = React.useState<string[] | null>(null);
  const [closeSuccessModalOpen, setCloseSuccessModalOpen] = React.useState(false);

  // 1. Cargar datos del inquilino y máquinas en montaje
  React.useEffect(() => {
    let isMounted = true;
    if (!slug) return;

    async function initializeTenantAndMachines() {
      try {
        const tenantRes = await fetch(`/api/tenants/${encodeURIComponent(slug)}`);
        const tenantData = await tenantRes.json();

        if (!isMounted) return;

        if (!tenantRes.ok) {
          setTenantError(tenantData.error || "No se pudo cargar la organización.");
          setTenant(null);
          setLoadingTenant(false);
          return;
        }

        setTenant(tenantData.tenant);
        setTenantError(null);

        // Cargar máquinas
        const machRes = await fetch(`/api/machines?org=${encodeURIComponent(slug)}`);
        if (machRes.ok && isMounted) {
          const machData = await machRes.json();
          const list: Machine[] = machData.machines || [];
          setMachines(list);

          if (qrMachineCode) {
            const match = list.find((m) => m.code.toUpperCase() === qrMachineCode);
            if (match) {
              setSelectedMachine(match);
              setDetectedByQr(true);
              setLoadingTenant(false);
              return;
            }
          }

          if (list.length > 0) {
            setSelectedMachine(list.find((m) => m.active) || list[0]);
          }
        }
      } catch (err) {
        console.error("Error al inicializar consola:", err);
        if (isMounted) setTenantError("Error de conexión al cargar la organización.");
      } finally {
        if (isMounted) setLoadingTenant(false);
      }
    }

    initializeTenantAndMachines();
    return () => {
      isMounted = false;
    };
  }, [slug, qrMachineCode]);

  // Recarga manual de máquinas (ej. tras crear una nueva)
  const refreshMachines = React.useCallback(async () => {
    if (!slug) return;
    try {
      const res = await fetch(`/api/machines?org=${encodeURIComponent(slug)}`);
      if (res.ok) {
        const data = await res.json();
        setMachines(data.machines || []);
      }
    } catch (err) {
      console.error("Error al refrescar máquinas:", err);
    }
  }, [slug]);

  // 2. Verificar sesión del usuario en montaje
  React.useEffect(() => {
    let isMounted = true;

    async function checkAuthSession() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.user) {
            setCurrentUser(data.user);
            setReview((prev) => {
              if (!prev.operator && data.user.name) {
                return { ...prev, operator: data.user.name };
              }
              return prev;
            });
          }
        }
      } catch {
        // Unauthenticated session is normal
      }
    }

    checkAuthSession();
    return () => {
      isMounted = false;
    };
  }, []);

  // 3. Cargar revisión activa de la máquina seleccionada
  React.useEffect(() => {
    let isMounted = true;
    const targetCode = selectedMachine?.code;
    if (!targetCode) return;

    async function loadReview(code: string) {
      try {
        const res = await fetch(
          `/api/reviews?machine=${encodeURIComponent(code)}`
        );
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.review?.payload?.current) {
            setReview(data.review.payload.current);
          } else {
            setReview((prev) => ({
              ...newInspection(),
              operator: currentUser?.name || prev.operator || "",
            }));
          }
          if (Array.isArray(data.review?.payload?.history)) {
            setHistoryList(data.review.payload.history);
          }
        }
      } catch (err) {
        console.error("Error al sincronizar revisión:", err);
      }
    }

    loadReview(targetCode);
    return () => {
      isMounted = false;
    };
  }, [selectedMachine, currentUser]);

  // Manejador para guardar revisión en la API
  const persistReview = React.useCallback(
    async (updatedState: ReviewState) => {
      if (!selectedMachine) return;
      setIsSaving(true);
      try {
        const res = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            machineId: selectedMachine.code,
            machineName: selectedMachine.name,
            current: updatedState,
            history: historyList,
            revision: 1,
            organizationId: tenant?.id,
          }),
        });
        if (res.ok) {
          setSaveMessage("Guardado");
          setTimeout(() => setSaveMessage(null), 2500);
        }
      } catch (err) {
        console.error("Error al guardar revisión:", err);
      } finally {
        setIsSaving(false);
      }
    },
    [selectedMachine, historyList, tenant]
  );

  // Modificaciones del checklist
  const handleCheckChange = (id: string, value: CheckValue) => {
    setReview((prev) => {
      const next = { ...prev };
      setCheck(next, id, value);
      persistReview(next);
      return next;
    });
  };

  const handleNoteChange = (id: string, note: string) => {
    setReview((prev) => {
      const next = {
        ...prev,
        checks: {
          ...prev.checks,
          [id]: {
            ...prev.checks[id],
            value: prev.checks[id]?.value || "pending",
            note,
            evidenceUrls: prev.checks[id]?.evidenceUrls || [],
          },
        },
      };
      persistReview(next);
      return next;
    });
  };

  const handleEvidenceChange = (id: string, urls: string[]) => {
    setReview((prev) => {
      const next = {
        ...prev,
        checks: {
          ...prev.checks,
          [id]: {
            ...prev.checks[id],
            value: prev.checks[id]?.value || "pending",
            note: prev.checks[id]?.note || "",
            evidenceUrls: urls,
          },
        },
      };
      persistReview(next);
      return next;
    });
  };

  const handleCloseShift = async () => {
    if (!selectedMachine) {
      alert("Por favor seleccione una máquina antes de cerrar el turno.");
      return;
    }
    if (!currentUser) {
      setAuthDialogOpen(true);
      return;
    }

    // Recolectar todas las evidencias fotográficas de los ítems
    const allEvidences: string[] = [];
    for (const key of Object.keys(review.checks || {})) {
      const entry = review.checks[key];
      if (Array.isArray(entry.evidenceUrls)) {
        allEvidences.push(...entry.evidenceUrls);
      }
    }

    // Validación preliminar de calidad
    const quality = validateReviewQuality({
      checks: review.checks,
      incidents: review.incidents,
      evidenceUrls: allEvidences,
    });

    if (!quality.valid) {
      setQualityValidationErrors(quality.errors);
      return;
    }

    setIsClosingShift(true);
    try {
      const res = await fetch("/api/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          machineId: selectedMachine.id,
          shift: review.shift,
          workOrder: review.ot,
          checklistPayload: review,
          incidentsCount: review.incidents?.filter((i) => !i.resolvedAt).length || 0,
          evidenceUrls: Array.from(new Set(allEvidences)),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.details && Array.isArray(data.details)) {
          setQualityValidationErrors(data.details);
        } else {
          alert(data.error || "No se pudo cerrar el turno.");
        }
        return;
      }

      setCloseSuccessModalOpen(true);
      const fresh = {
        ...newInspection(),
        operator: currentUser.name,
      };
      setReview(fresh);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al conectar con el servidor.";
      alert(message);
    } finally {
      setIsClosingShift(false);
    }
  };

  const handleFieldChange = (field: keyof ReviewState, value: string | boolean) => {
    setReview((prev) => {
      const next = { ...prev, [field]: value };
      persistReview(next);
      return next;
    });
  };

  const handleVerify = () => {
    try {
      setReview((prev) => {
        const next = { ...prev };
        verify(next);
        persistReview(next);
        return next;
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo validar la revisión.";
      alert(message);
    }
  };

  const handleNewInspection = () => {
    if (confirm("¿Deseas iniciar una nueva inspección? La actual se archivará en el historial.")) {
      const archived: ReviewRecord = { ...review };
      const nextHistory = [...historyList, archived].slice(-50);
      const fresh = {
        ...newInspection(),
        operator: currentUser?.name || review.operator,
      };
      setHistoryList(nextHistory);
      setReview(fresh);
      persistReview(fresh);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setCurrentUser(null);
    }
  };

  // 1. Pantalla de carga
  if (loadingTenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Iniciando consola operativa...</span>
        </div>
      </div>
    );
  }

  // 2. Pantalla de error de inquilino (404 o suspendido)
  if (tenantError || !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full border-border bg-card shadow-2xl text-center p-6 space-y-4">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
            <Lock className="size-6" />
          </div>
          <CardTitle className="text-xl font-bold">Acceso a la Organización</CardTitle>
          <p className="text-sm text-muted-foreground">
            {tenantError || "La organización solicitada no existe o se encuentra inactiva."}
          </p>
          <div className="pt-2">
            <Button variant="outline" asChild>
              <Link href="/">Volver al inicio</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const status = getStatus(review);
  const activeIncidentsCount = review.incidents?.filter((i) => !i.resolvedAt).length || 0;
  const isManagerOrAdmin = currentUser?.role === "gerente" || currentUser?.role === "superadmin";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* HEADER PRINCIPAL */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-md px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Logo y Empresa */}
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary shrink-0">
              <Building2 className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base sm:text-lg leading-tight">{tenant.name}</h1>
                <Badge variant="outline" className="text-[10px] uppercase font-semibold text-primary border-primary/30">
                  {tenant.plan}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Control previo al uso de maquinaria CNC</p>
            </div>
          </div>

          {/* Selector de Máquina y Acciones de Usuario */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Máquina Select */}
            <div className="flex items-center gap-1.5">
              <Server className="size-4 text-muted-foreground hidden sm:inline" />
              <Select
                value={selectedMachine?.id || ""}
                onValueChange={(val) => {
                  const m = machines.find((x) => x.id === val);
                  if (m) {
                    setSelectedMachine(m);
                    setDetectedByQr(false);
                  }
                }}
              >
                <SelectTrigger className="w-[180px] sm:w-[210px] h-8 text-xs font-mono">
                  <SelectValue placeholder="Seleccionar máquina..." />
                </SelectTrigger>
                <SelectContent>
                  {machines.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs font-mono">
                      {m.code} · {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Usuario / Sesión */}
            {currentUser ? (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs capitalize py-1">
                  {currentUser.name} ({currentUser.role})
                </Badge>
                <Button variant="ghost" size="sm" onClick={handleLogout} className="h-8 text-xs gap-1">
                  <LogOut className="size-3.5" />
                  <span className="hidden sm:inline">Salir</span>
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={() => setAuthDialogOpen(true)} className="h-8 text-xs gap-1.5">
                <LogIn className="size-3.5" />
                <span>Identificarse</span>
              </Button>
            )}
          </div>
        </div>

        {/* Banner de QR detectado si aplica */}
        {detectedByQr && selectedMachine && (
          <div className="max-w-7xl mx-auto mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-xs text-primary bg-primary/5 px-3 py-1.5 rounded-md">
            <div className="flex items-center gap-2">
              <QrCode className="size-4" />
              <span>
                Máquina detectada por QR: <strong>{selectedMachine.code}</strong> ({selectedMachine.name})
              </span>
            </div>
            <button
              onClick={() => setDetectedByQr(false)}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              Cambiar
            </button>
          </div>
        )}
      </header>

      {/* CONTENIDO OPERATIVO */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex-1 space-y-6 w-full">
        {/* BARRA SUPERIOR DE ACCIONES Y MÓDULOS */}
        <section className="flex flex-wrap items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIncidentsModalOpen(true)}
              className={`h-8 text-xs gap-1.5 ${
                activeIncidentsCount > 0
                  ? "border-destructive text-destructive hover:bg-destructive/10"
                  : ""
              }`}
            >
              <AlertOctagon className="size-3.5" />
              <span>Alarmas e Incidencias</span>
              {activeIncidentsCount > 0 && (
                <Badge variant="destructive" className="size-4 p-0 flex items-center justify-center text-[10px]">
                  {activeIncidentsCount}
                </Badge>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setHistoryModalOpen(true)}
              className="h-8 text-xs gap-1.5"
            >
              <History className="size-3.5" />
              <span>Historial</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setGuideModalOpen(true)}
              className="h-8 text-xs gap-1.5"
            >
              <BookOpen className="size-3.5" />
              <span>Guía de Uso</span>
            </Button>

            {/* Cerrar y Registrar Turno */}
            <Button
              size="sm"
              onClick={handleCloseShift}
              disabled={isClosingShift}
              className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 font-medium shadow-xs"
            >
              {isClosingShift ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3.5" />
              )}
              <span>Cerrar y Registrar Turno</span>
            </Button>

            {/* Módulos exclusivos de Gerente / Super Admin */}
            {isManagerOrAdmin && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setMachinesModalOpen(true)}
                  className="h-8 text-xs gap-1.5"
                >
                  <Server className="size-3.5" />
                  <span>Máquinas y QR</span>
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setTeamModalOpen(true)}
                  className="h-8 text-xs gap-1.5"
                >
                  <Users className="size-3.5" />
                  <span>Equipo / Perfiles</span>
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isSaving ? (
              <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                <Loader2 className="size-3 animate-spin" /> Guardando...
              </span>
            ) : saveMessage ? (
              <span className="text-xs text-emerald-400 font-mono animate-fade-in">
                ✓ {saveMessage}
              </span>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNewInspection}
              className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-3.5" />
              <span>Nueva revisión</span>
            </Button>
          </div>
        </section>

        {/* STATUS & PROGRESS HERO CARD */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="md:col-span-2 border-border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <span>Estado Operativo:</span>
                    {status.code === "ready" ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600 gap-1 text-xs">
                        <CheckCircle2 className="size-3.5" />
                        Autorizado para corte
                      </Badge>
                    ) : status.code === "blocked" ? (
                      <Badge variant="destructive" className="gap-1 text-xs">
                        <AlertOctagon className="size-3.5" />
                        Bloqueado por anomalía o alarma
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1 text-xs text-amber-400">
                        <Clock className="size-3.5" />
                        Revisión previa pendiente
                      </Badge>
                    )}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedMachine ? `${selectedMachine.name} (${selectedMachine.code})` : "Selecciona una máquina"}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-2xl font-black font-mono">
                    {status.ok} / {status.total}
                  </span>
                  <span className="text-xs text-muted-foreground block">Puntos Conformes</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-muted/50 rounded-full h-2.5 mt-3 overflow-hidden">
                <div
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    status.code === "ready"
                      ? "bg-emerald-500"
                      : status.code === "blocked"
                      ? "bg-destructive"
                      : "bg-primary"
                  }`}
                  style={{ width: `${(status.ok / status.total) * 100}%` }}
                />
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              {status.reasons.length > 0 ? (
                <div className="space-y-1 mt-1 text-xs text-muted-foreground bg-muted/20 p-2.5 rounded-lg border border-border/40">
                  <span className="font-semibold text-foreground text-[11px] block">Condiciones pendientes:</span>
                  <ul className="list-disc list-inside space-y-0.5">
                    {status.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="text-xs text-emerald-400 font-medium py-1 flex items-center gap-1.5">
                  <CheckCircle2 className="size-4" />
                  <span>Todos los puntos completados. Puedes validar para autorizar el corte.</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* DATOS DEL TURNO */}
          <Card className="border-border bg-card shadow-sm flex flex-col justify-between">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Datos del Turno</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs flex-1">
              <div className="space-y-1">
                <Label htmlFor="rev-operator" className="text-[11px] text-muted-foreground">
                  Operador Responsable *
                </Label>
                <Input
                  id="rev-operator"
                  value={review.operator}
                  onChange={(e) => handleFieldChange("operator", e.target.value)}
                  placeholder="Nombre del operario"
                  className="h-8 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="rev-ot" className="text-[11px] text-muted-foreground">
                    OT / Trabajo
                  </Label>
                  <Input
                    id="rev-ot"
                    value={review.ot}
                    onChange={(e) => handleFieldChange("ot", e.target.value)}
                    placeholder="Ej. OT-1044"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="rev-shift" className="text-[11px] text-muted-foreground">
                    Momento
                  </Label>
                  <Select
                    value={review.shift}
                    onValueChange={(val) => handleFieldChange("shift", val)}
                  >
                    <SelectTrigger id="rev-shift" className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Inicio de turno">Inicio de turno</SelectItem>
                      <SelectItem value="Mitad de turno">Mitad de turno</SelectItem>
                      <SelectItem value="Fin de turno">Fin de turno</SelectItem>
                      <SelectItem value="Parada / Mantenimiento">Parada / Mantenimiento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Confirmación de Alarmas */}
              <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                <Label htmlFor="rev-alarm" className="text-[11px] leading-tight cursor-pointer">
                  Panel verificado (Sin alarmas activas)
                </Label>
                <Switch
                  id="rev-alarm"
                  checked={review.alarmReviewed}
                  onCheckedChange={(checked) => handleFieldChange("alarmReviewed", checked)}
                />
              </div>

              <Button
                onClick={handleVerify}
                disabled={!status.eligible}
                className={`w-full mt-2 h-9 text-xs font-semibold gap-1.5 ${
                  review.verifiedAt ? "bg-emerald-600 hover:bg-emerald-700" : ""
                }`}
              >
                <ShieldCheck className="size-4" />
                <span>{review.verifiedAt ? "Revisión Validada ✓" : "Validar para Corte"}</span>
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* CHECKLIST PREVENTIVO DE 14 PUNTOS */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Checklist Preventivo</h2>
              <p className="text-xs text-muted-foreground">
                Verifica cada ítem antes de encender el rayo y empezar el corte.
              </p>
            </div>
          </div>

          <CncChecklist
            checks={review.checks}
            onCheckChange={handleCheckChange}
            onNoteChange={handleNoteChange}
            onEvidenceChange={handleEvidenceChange}
            machineCode={selectedMachine?.code || "CNC"}
          />
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-border py-4 px-6 text-center text-xs text-muted-foreground bg-card/40">
        <p>Registro compartido · Manual V1. - Desarrollado por Santiago Caipo</p>
      </footer>

      {/* MODAL DE REQUISITOS DE CALIDAD PENDIENTES */}
      <Dialog
        open={!!qualityValidationErrors}
        onOpenChange={(open) => !open && setQualityValidationErrors(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertOctagon className="size-5" />
              <DialogTitle className="text-base font-bold">
                Requisitos de Calidad Pendientes
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Para cerrar oficialmente el turno y registrar el historial inmutable, debe subsanar los siguientes puntos:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {qualityValidationErrors?.map((err, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive flex items-start gap-2"
              >
                <span className="font-bold">•</span>
                <span>{err}</span>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQualityValidationErrors(null)}
            >
              Entendido, completar observaciones y fotos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE CONFIRMACIÓN DE TURNO CERRADO */}
      <Dialog
        open={closeSuccessModalOpen}
        onOpenChange={setCloseSuccessModalOpen}
      >
        <DialogContent className="max-w-sm text-center">
          <div className="size-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mt-2">
            <CheckCircle2 className="size-7" />
          </div>
          <DialogHeader className="text-center sm:text-center">
            <DialogTitle className="text-lg font-bold">
              Turno Cerrado Exitosamente
            </DialogTitle>
            <DialogDescription className="text-xs">
              El registro oficial ha sido archivado de manera inmutable en el historial. El puesto queda listo para el siguiente turno.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center pt-2">
            <Button
              size="sm"
              onClick={() => {
                setCloseSuccessModalOpen(false);
                setHistoryModalOpen(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
            >
              <History className="size-3.5" />
              <span>Ver en Historial Inmutable</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODALES AUXILIARES */}
      <CncAuthDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
        slug={slug}
        tenantName={tenant.name}
        onSuccess={(user) => {
          setCurrentUser(user as CurrentUser);
          setReview((prev) => ({ ...prev, operator: user.name }));
        }}
      />

      <CncMachinesModal
        open={machinesModalOpen}
        onOpenChange={setMachinesModalOpen}
        slug={slug}
        tenantName={tenant.name}
        maxMachines={tenant.maxMachines}
        machines={machines}
        onMachinesChange={refreshMachines}
      />

      <CncTeamModal
        open={teamModalOpen}
        onOpenChange={setTeamModalOpen}
        tenantName={tenant.name}
      />

      <CncHistoryModal
        open={historyModalOpen}
        onOpenChange={setHistoryModalOpen}
        machineCode={selectedMachine?.code || "CNC"}
        currentUserRole={currentUser?.role}
      />

      <CncGuideModal open={guideModalOpen} onOpenChange={setGuideModalOpen} />

      <CncIncidentsModal
        open={incidentsModalOpen}
        onOpenChange={setIncidentsModalOpen}
        incidents={review.incidents || []}
        onAddIncident={(data) => {
          setReview((prev) => {
            const next = { ...prev };
            addIncident(next, data);
            persistReview(next);
            return next;
          });
        }}
        onResolveIncident={(id, resp, resol) => {
          setReview((prev) => {
            const next = { ...prev };
            resolveIncident(next, id, resp, resol);
            persistReview(next);
            return next;
          });
        }}
      />
    </div>
  );
}

export default function TenantPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <TenantConsoleContent />
    </React.Suspense>
  );
}
