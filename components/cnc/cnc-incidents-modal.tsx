"use client";

import * as React from "react";
import { AlertOctagon, Plus, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GUIDES, Incident } from "@/lib/cnc-model";

interface CncIncidentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incidents: Incident[];
  onAddIncident: (data: { guideId: string; text: string; context: string }) => void;
  onResolveIncident: (id: string, responsible: string, resolution: string) => void;
}

export function CncIncidentsModal({
  open,
  onOpenChange,
  incidents,
  onAddIncident,
  onResolveIncident,
}: CncIncidentsModalProps) {
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [guideId, setGuideId] = React.useState("otra");
  const [text, setText] = React.useState("");
  const [context, setContext] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);

  // Resolving state
  const [resolvingId, setResolvingId] = React.useState<string | null>(null);
  const [responsible, setResponsible] = React.useState("");
  const [resolution, setResolution] = React.useState("");
  const [resolveError, setResolveError] = React.useState<string | null>(null);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setFormError("Describe el mensaje o código de la alarma.");
      return;
    }
    setFormError(null);
    onAddIncident({
      guideId,
      text: text.trim(),
      context: context.trim(),
    });
    setText("");
    setContext("");
    setGuideId("otra");
    setShowAddForm(false);
  };

  const handleResolveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingId || !responsible.trim() || resolution.trim().length < 10) {
      setResolveError("Indica el responsable y una comprobación de al menos 10 caracteres.");
      return;
    }
    setResolveError(null);
    onResolveIncident(resolvingId, responsible.trim(), resolution.trim());
    setResolvingId(null);
    setResponsible("");
    setResolution("");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-destructive/10 text-destructive">
                <AlertOctagon className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">Alarmas e Incidencias</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Registro de fallas, bloqueos y evidencias de comprobación para la máquina.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-sm font-medium">
                Incidencias Registradas ({incidents.length})
              </span>
              {!showAddForm && (
                <Button size="sm" onClick={() => setShowAddForm(true)} className="gap-1.5">
                  <Plus className="size-4" />
                  <span>Reportar Alarma</span>
                </Button>
              )}
            </div>

            {/* Formulario Nueva Alarma */}
            {showAddForm && (
              <form
                onSubmit={handleAddSubmit}
                className="rounded-lg border border-border/80 bg-muted/20 p-4 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-destructive">Registrar Nueva Alarma</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddForm(false)}
                    className="h-7 text-xs"
                  >
                    Cancelar
                  </Button>
                </div>

                {formError && (
                  <div className="flex items-center gap-2 rounded-lg bg-destructive/15 border border-destructive/30 p-2.5 text-xs text-destructive">
                    <AlertTriangle className="size-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="inc-guide" className="text-xs">
                    Tipo de Problema o Guía Asociada
                  </Label>
                  <Select value={guideId} onValueChange={(val) => setGuideId(val)}>
                    <SelectTrigger id="inc-guide" className="w-full text-xs">
                      <SelectValue placeholder="Selecciona una categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {GUIDES.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name} ({g.system})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inc-text" className="text-xs">
                    Código de Alarma o Descripción del Fallo *
                  </Label>
                  <Input
                    id="inc-text"
                    placeholder="Ej. Alarma 102 - Foco descentrado o presión de O2 baja"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inc-context" className="text-xs">
                    Contexto de Aparición (Opcional)
                  </Label>
                  <Textarea
                    id="inc-context"
                    placeholder="Qué operación se ejecutaba, material, espesor o comportamiento..."
                    rows={2}
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddForm(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" size="sm" variant="destructive">
                    Registrar Incidencia
                  </Button>
                </div>
              </form>
            )}

            {/* Listado de Incidencias */}
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {incidents.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground border rounded-lg border-dashed">
                  No hay alarmas ni incidencias registradas en este turno.
                </div>
              ) : (
                incidents.map((inc) => {
                  const isResolved = !!inc.resolvedAt;
                  return (
                    <div
                      key={inc.id}
                      className={`p-3.5 rounded-lg border text-xs space-y-2 ${
                        isResolved
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : "border-destructive/30 bg-destructive/5"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground">{inc.text}</span>
                            <Badge
                              variant={isResolved ? "outline" : "destructive"}
                              className="text-[10px]"
                            >
                              {isResolved ? "Resuelta" : "Abierta · Bloqueante"}
                            </Badge>
                          </div>
                          <span className="text-[11px] text-muted-foreground block mt-0.5">
                            Reportada: {new Date(inc.createdAt).toLocaleTimeString("es-ES")}
                          </span>
                        </div>

                        {!isResolved && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setResolvingId(inc.id);
                              setResponsible("");
                              setResolution("");
                              setResolveError(null);
                            }}
                            className="h-7 text-xs gap-1 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                          >
                            <CheckCircle2 className="size-3.5" />
                            <span>Resolver</span>
                          </Button>
                        )}
                      </div>

                      {inc.context && (
                        <p className="text-muted-foreground bg-muted/20 p-2 rounded border border-border/50">
                          {inc.context}
                        </p>
                      )}

                      {isResolved && (
                        <div className="pt-1 border-t border-border/40 text-emerald-300">
                          <strong>Comprobación ({inc.responsible}):</strong> {inc.resolution}
                        </div>
                      )}
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

      {/* Modal Resolver Incidencia */}
      <Dialog open={!!resolvingId} onOpenChange={(open) => !open && setResolvingId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-emerald-400">
              <ShieldCheck className="size-5" />
              <span>Resolver Incidencia y Comprobación</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Registra la acción correctiva y comprobación de funcionamiento antes de continuar el uso.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleResolveSubmit} className="space-y-4 pt-2">
            {resolveError && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/15 border border-destructive/30 p-2.5 text-xs text-destructive">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{resolveError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="res-resp" className="text-xs">
                Responsable de la intervención *
              </Label>
              <Input
                id="res-resp"
                placeholder="Nombre del técnico u operador"
                value={responsible}
                onChange={(e) => setResponsible(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="res-text" className="text-xs">
                Comprobación realizada (Mínimo 10 caracteres) *
              </Label>
              <Textarea
                id="res-text"
                placeholder="Detalla qué se reparó o ajustó y la prueba de corte realizada..."
                rows={3}
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setResolvingId(null)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                Confirmar Resolución
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

