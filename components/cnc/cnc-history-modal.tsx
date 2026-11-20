"use client";

import * as React from "react";
import {
  History,
  Calendar,
  CheckCircle2,
  AlertOctagon,
  Clock,
  Search,
  ChevronRight,
  ShieldCheck,
  Camera,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CHECKS } from "@/lib/cnc-model";

export interface SnapshotRecord {
  id: string;
  shift: string;
  workOrder: string;
  status: "ok" | "warning" | "critical";
  checklistPayload: {
    checks?: Record<string, { value?: string; note?: string; evidenceUrls?: string[] }>;
    incidents?: unknown[];
    notes?: string;
  };
  incidentsCount: number;
  evidenceUrls: string[];
  supervisorApprovedAt: string | null;
  createdAt: string;
  machine?: {
    id: string;
    code: string;
    name: string;
    model: string;
  };
  operator?: {
    id: string;
    name: string;
    role: string;
  };
  supervisor?: {
    id: string;
    name: string;
    role: string;
  } | null;
}

interface CncHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  machineCode: string;
  currentUserRole?: string | null;
  onSnapshotApproved?: () => void;
}

export function CncHistoryModal({
  open,
  onOpenChange,
  machineCode,
  currentUserRole,
  onSnapshotApproved,
}: CncHistoryModalProps) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedSnapshot, setSelectedSnapshot] = React.useState<SnapshotRecord | null>(null);
  const [snapshots, setSnapshots] = React.useState<SnapshotRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [approvingId, setApprovingId] = React.useState<string | null>(null);
  const [approveError, setApproveError] = React.useState<string | null>(null);
  const [previewImage, setPreviewImage] = React.useState<string | null>(null);

  const canApprove =
    currentUserRole === "supervisor" ||
    currentUserRole === "gerente" ||
    currentUserRole === "superadmin";

  const fetchSnapshots = React.useCallback(async () => {
    if (!machineCode) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/snapshots?machineId=${encodeURIComponent(machineCode)}`);
      if (res.ok) {
        const data = await res.json();
        setSnapshots(data.snapshots || []);
      }
    } catch (err) {
      console.error("Error al cargar historial inmutable:", err);
    } finally {
      setLoading(false);
    }
  }, [machineCode]);

  React.useEffect(() => {
    let isMounted = true;
    if (!open || !machineCode) return;

    async function load() {
      try {
        const res = await fetch(`/api/snapshots?machineId=${encodeURIComponent(machineCode)}`);
        if (res.ok && isMounted) {
          const data = await res.json();
          setSnapshots(data.snapshots || []);
        }
      } catch (err) {
        console.error("Error al cargar historial inmutable:", err);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [open, machineCode]);

  const handleApprove = async (snapshotId: string) => {
    setApprovingId(snapshotId);
    setApproveError(null);
    try {
      const res = await fetch(`/api/snapshots/${snapshotId}/approve`, {
        method: "PATCH",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo validar la revisión");
      }
      await fetchSnapshots();
      if (selectedSnapshot && selectedSnapshot.id === snapshotId) {
        setSelectedSnapshot(data.snapshot);
      }
      if (onSnapshotApproved) {
        onSnapshotApproved();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al validar la revisión";
      setApproveError(message);
    } finally {
      setApprovingId(null);
    }
  };

  const filteredSnapshots = snapshots.filter((r) => {
    const term = searchTerm.toLowerCase();
    const dateFormatted = new Date(r.createdAt).toLocaleDateString("es-PE");
    return (
      dateFormatted.includes(term) ||
      (r.operator?.name && r.operator.name.toLowerCase().includes(term)) ||
      (r.workOrder && r.workOrder.toLowerCase().includes(term)) ||
      (r.shift && r.shift.toLowerCase().includes(term))
    );
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <History className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">Historial Inmutable de Turnos</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Registros oficiales y verificados para la máquina{" "}
                  <strong className="text-foreground font-mono">{machineCode}</strong>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Filtrar por fecha, operador, turno u OT..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchSnapshots}
                disabled={loading}
                className="h-9 text-xs"
              >
                {loading ? <Loader2 className="size-3 animate-spin" /> : "Actualizar"}
              </Button>
            </div>

            {approveError && (
              <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                {approveError}
              </div>
            )}

            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {loading && snapshots.length === 0 ? (
                <div className="text-center py-12 text-xs text-muted-foreground">
                  <Loader2 className="size-6 animate-spin mx-auto mb-2 text-primary" />
                  Cargando historial inmutable...
                </div>
              ) : filteredSnapshots.length === 0 ? (
                <div className="text-center py-10 text-xs text-muted-foreground border rounded-lg border-dashed">
                  No hay revisiones cerradas archivadas para los filtros aplicados.
                </div>
              ) : (
                filteredSnapshots.map((record) => {
                  const dateObj = new Date(record.createdAt);
                  const dateStr = dateObj.toLocaleDateString("es-PE");
                  const timeStr = dateObj.toLocaleTimeString("es-PE", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const isApproved = !!record.supervisorApprovedAt;
                  const checks = (record.checklistPayload?.checks || {}) as Record<
                    string,
                    { value?: string; note?: string; evidenceUrls?: string[] }
                  >;
                  const faultCount = CHECKS.filter((c) => checks[c.id]?.value === "fault").length;
                  const allPhotos: string[] = [
                    ...(Array.isArray(record.evidenceUrls) ? record.evidenceUrls : []),
                    ...Object.values(checks).flatMap((c) =>
                      Array.isArray(c?.evidenceUrls) ? c.evidenceUrls : []
                    ),
                  ];
                  const uniquePhotos = Array.from(new Set(allPhotos));

                  return (
                    <div
                      key={record.id}
                      onClick={() => setSelectedSnapshot(record)}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg border border-border bg-card/60 hover:bg-muted/40 cursor-pointer transition-all gap-3"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-sm">{dateStr}</span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {timeStr} · {record.shift}
                          </span>

                          {/* Badge de Estado del Turno */}
                          {record.status === "ok" ? (
                            <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30 gap-1">
                              <CheckCircle2 className="size-3" />
                              Conforme
                            </Badge>
                          ) : record.status === "warning" ? (
                            <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30 gap-1">
                              <AlertTriangle className="size-3" />
                              Alerta
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px] gap-1">
                              <AlertOctagon className="size-3" />
                              {faultCount > 0 ? `${faultCount} Anomalía(s)` : "Crítico"}
                            </Badge>
                          )}

                          {/* Badge de Supervisión */}
                          {isApproved ? (
                            <Badge variant="secondary" className="text-[10px] text-emerald-400 gap-1">
                              <ShieldCheck className="size-3 text-emerald-400" />
                              Validado por {record.supervisor?.name || "Supervisor"}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30 gap-1">
                              <Clock className="size-3" />
                              Pendiente de firma
                            </Badge>
                          )}
                        </div>

                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                          <span>
                            Operador: <strong className="text-foreground">{record.operator?.name || "Sin registrar"}</strong>
                          </span>
                          {record.workOrder && (
                            <span>
                              OT: <strong className="text-foreground font-mono">{record.workOrder}</strong>
                            </span>
                          )}
                          {uniquePhotos.length > 0 && (
                            <span className="text-primary flex items-center gap-1">
                              <Camera className="size-3" />
                              {uniquePhotos.length} foto(s)
                            </span>
                          )}
                        </div>

                        {/* Galería rápida de miniaturas si existen */}
                        {uniquePhotos.length > 0 && (
                          <div className="flex items-center gap-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
                            {uniquePhotos.slice(0, 4).map((url, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setPreviewImage(url)}
                                className="size-9 rounded border border-border/80 overflow-hidden hover:opacity-80 transition-opacity"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={url} alt={`Evidencia ${i + 1}`} className="size-full object-cover" />
                              </button>
                            ))}
                            {uniquePhotos.length > 4 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{uniquePhotos.length - 4} más
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {!isApproved && canApprove && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApprove(record.id);
                            }}
                            disabled={approvingId === record.id}
                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                          >
                            {approvingId === record.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <ShieldCheck className="size-3.5" />
                            )}
                            <span>Firmar</span>
                          </Button>
                        )}
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalle de Snapshot Inmutable */}
      <Dialog open={!!selectedSnapshot} onOpenChange={(open) => !open && setSelectedSnapshot(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          {selectedSnapshot && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <Calendar className="size-5 text-primary" />
                  <span>
                    Detalle de Turno · {new Date(selectedSnapshot.createdAt).toLocaleDateString("es-PE")}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {selectedSnapshot.shift} · OT: {selectedSnapshot.workOrder || "N/A"} · Operador:{" "}
                  {selectedSnapshot.operator?.name || "N/A"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-2 text-xs">
                {/* Métricas del turno */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-muted/20 rounded-lg border border-border">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Hora Registro</span>
                    <span className="font-semibold font-mono">
                      {new Date(selectedSnapshot.createdAt).toLocaleTimeString("es-PE", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Estado</span>
                    <span className="font-semibold capitalize">
                      {selectedSnapshot.status === "ok"
                        ? "Conforme"
                        : selectedSnapshot.status === "warning"
                        ? "Alerta"
                        : "Crítico"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Supervisión</span>
                    <span className="font-semibold text-emerald-400">
                      {selectedSnapshot.supervisorApprovedAt ? "Validada ✓" : "Pendiente"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Incidencias</span>
                    <span className="font-semibold">{selectedSnapshot.incidentsCount}</span>
                  </div>
                </div>

                {/* Supervisor Signature info banner */}
                {selectedSnapshot.supervisorApprovedAt ? (
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-400">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-4" />
                      <span>
                        Validado formalmente por{" "}
                        <strong>{selectedSnapshot.supervisor?.name || "Supervisor"}</strong>
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {new Date(selectedSnapshot.supervisorApprovedAt).toLocaleString("es-PE")}
                    </span>
                  </div>
                ) : canApprove ? (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2">
                    <div className="text-xs text-amber-300">
                      <p className="font-semibold">Revisión pendiente de validación formal.</p>
                      <p className="text-[11px] text-muted-foreground">
                        Como {currentUserRole}, puedes firmar este registro oficial.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleApprove(selectedSnapshot.id)}
                      disabled={approvingId === selectedSnapshot.id}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1 h-8 shrink-0"
                    >
                      {approvingId === selectedSnapshot.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <ShieldCheck className="size-3.5" />
                      )}
                      <span>Validar y Firmar</span>
                    </Button>
                  </div>
                ) : null}

                {/* Checklist de 14 Puntos */}
                <div className="space-y-2">
                  <span className="font-bold text-sm block">Checklist de 14 Puntos</span>
                  <div className="space-y-1.5 border rounded-lg p-2 max-h-60 overflow-y-auto">
                    {CHECKS.map((c) => {
                      const entry = selectedSnapshot.checklistPayload?.checks?.[c.id];
                      const val = entry?.value || "pending";
                      const itemPhotos: string[] = entry?.evidenceUrls || [];

                      return (
                        <div
                          key={c.id}
                          className="flex flex-col gap-1.5 p-2 rounded border border-border/50 text-xs"
                        >
                          <div className="flex items-start justify-between">
                            <span className="font-medium text-foreground">{c.title}</span>
                            <Badge
                              variant={
                                val === "ok" ? "default" : val === "fault" ? "destructive" : "secondary"
                              }
                              className="capitalize text-[10px] shrink-0"
                            >
                              {val === "ok" ? "Conforme" : val === "fault" ? "Anomalía" : "Pendiente"}
                            </Badge>
                          </div>

                          {entry?.note && (
                            <p className="text-[11px] text-muted-foreground italic">
                              Nota: {entry.note}
                            </p>
                          )}

                          {itemPhotos.length > 0 && (
                            <div className="flex items-center gap-1.5 pt-1">
                              {itemPhotos.map((url, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setPreviewImage(url)}
                                  className="size-10 rounded border border-border overflow-hidden hover:opacity-80 transition-opacity"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={url}
                                    alt={`Evidencia ${c.id}`}
                                    className="size-full object-cover"
                                  />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Evidencias globales si existen */}
                {selectedSnapshot.evidenceUrls?.length > 0 && (
                  <div className="space-y-2">
                    <span className="font-bold text-sm block">Fotografías Adjuntas</span>
                    <div className="flex flex-wrap gap-2">
                      {selectedSnapshot.evidenceUrls.map((url, i) => (
                        <div
                          key={i}
                          onClick={() => setPreviewImage(url)}
                          className="size-16 rounded-lg overflow-hidden border border-border cursor-pointer hover:opacity-80 transition-opacity"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`Evidencia ${i + 1}`} className="size-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="pt-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedSnapshot(null)}>
                  Cerrar Detalle
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Lightbox de Foto */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-2xl p-2 bg-black/90 border-border text-white">
          <DialogHeader className="p-2 border-b border-white/10">
            <DialogTitle className="text-sm font-semibold text-white">
              Vista Previa de Evidencia
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-2">
            {previewImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewImage}
                alt="Vista previa"
                className="max-h-[75vh] w-auto max-w-full rounded-md object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
