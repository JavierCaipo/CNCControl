"use client";

import * as React from "react";
import { History, Calendar, CheckCircle2, AlertOctagon, Clock, Search, ChevronRight } from "lucide-react";
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

interface CncHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  machineCode: string;
  history: ReviewRecord[];
}

export function CncHistoryModal({
  open,
  onOpenChange,
  machineCode,
  history,
}: CncHistoryModalProps) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedRecord, setSelectedRecord] = React.useState<ReviewRecord | null>(null);

  const filteredHistory = history.filter((r) => {
    const term = searchTerm.toLowerCase();
    return (
      r.date.includes(term) ||
      (r.operator && r.operator.toLowerCase().includes(term)) ||
      (r.ot && r.ot.toLowerCase().includes(term))
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
                <DialogTitle className="text-xl font-bold">Historial de Revisiones</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Registros compartidos de verificaciones para la máquina{" "}
                  <strong className="text-foreground">{machineCode}</strong>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="relative">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filtrar por fecha, operador u OT..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {filteredHistory.length === 0 ? (
                <div className="text-center py-10 text-xs text-muted-foreground border rounded-lg border-dashed">
                  No hay revisiones archivadas para los filtros aplicados.
                </div>
              ) : (
                filteredHistory.map((record) => {
                  const okCount = CHECKS.filter((c) => record.checks?.[c.id]?.value === "ok").length;
                  const faultCount = CHECKS.filter((c) => record.checks?.[c.id]?.value === "fault").length;
                  const isVerified = !!record.verifiedAt;

                  return (
                    <div
                      key={record.id}
                      onClick={() => setSelectedRecord(record)}
                      className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-card/60 hover:bg-muted/40 cursor-pointer transition-all gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{record.date}</span>
                          <span className="text-xs text-muted-foreground">· {record.shift}</span>
                          {isVerified ? (
                            <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30 gap-1">
                              <CheckCircle2 className="size-3" />
                              Validada
                            </Badge>
                          ) : faultCount > 0 ? (
                            <Badge variant="destructive" className="text-[10px] gap-1">
                              <AlertOctagon className="size-3" />
                              {faultCount} Anomalía(s)
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] gap-1">
                              <Clock className="size-3" />
                              Pendiente
                            </Badge>
                          )}
                        </div>

                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                          <span>
                            Operador: <strong className="text-foreground">{record.operator || "Sin registrar"}</strong>
                          </span>
                          {record.ot && (
                            <span>
                              OT: <strong className="text-foreground">{record.ot}</strong>
                            </span>
                          )}
                          <span>Puntos: {okCount} / {CHECKS.length} conformes</span>
                          {record.incidents?.length > 0 && (
                            <span className="text-amber-400">
                              {record.incidents.length} incidencia(s)
                            </span>
                          )}
                        </div>
                      </div>

                      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
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

      {/* Record Detail Dialog */}
      <Dialog open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          {selectedRecord && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <Calendar className="size-5 text-primary" />
                  <span>Detalle de Revisión · {selectedRecord.date}</span>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {selectedRecord.shift} · OT: {selectedRecord.ot || "N/A"} · Operador: {selectedRecord.operator}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-2 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-muted/20 rounded-lg border border-border">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Fecha</span>
                    <span className="font-semibold">{selectedRecord.date}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Validación</span>
                    <span className="font-semibold text-emerald-400">
                      {selectedRecord.verifiedAt
                        ? new Date(selectedRecord.verifiedAt).toLocaleTimeString("es-ES")
                        : "Sin validar"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Incidencias</span>
                    <span className="font-semibold">{selectedRecord.incidents?.length || 0}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="font-bold text-sm block">Checklist de 14 Puntos</span>
                  <div className="space-y-1.5 border rounded-lg p-2 max-h-60 overflow-y-auto">
                    {CHECKS.map((c) => {
                      const entry = selectedRecord.checks?.[c.id];
                      const val = entry?.value || "pending";
                      return (
                        <div
                          key={c.id}
                          className="flex items-start justify-between p-2 rounded border border-border/50 text-xs"
                        >
                          <div className="pr-2">
                            <span className="font-medium text-foreground">{c.title}</span>
                            {entry?.note && (
                              <p className="text-[11px] text-muted-foreground mt-0.5 italic">
                                Nota: {entry.note}
                              </p>
                            )}
                          </div>
                          <Badge
                            variant={
                              val === "ok" ? "default" : val === "fault" ? "destructive" : "secondary"
                            }
                            className="capitalize text-[10px] shrink-0"
                          >
                            {val === "ok" ? "Conforme" : val === "fault" ? "Anomalía" : "Pendiente"}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {selectedRecord.notes && (
                  <div className="space-y-1">
                    <span className="font-bold text-sm block">Observaciones Generales</span>
                    <p className="p-2.5 rounded bg-muted/20 border border-border text-xs text-muted-foreground">
                      {selectedRecord.notes}
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter className="pt-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedRecord(null)}>
                  Cerrar Detalle
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

