"use client";

import * as React from "react";
import {
  CheckCircle2,
  AlertOctagon,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Camera,
  X,
  Loader2,
  ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CHECKS, CheckDefinition, CheckValue, CheckEntry } from "@/lib/cnc-model";

interface CncChecklistProps {
  checks: Record<string, CheckEntry>;
  onCheckChange: (id: string, value: CheckValue) => void;
  onNoteChange: (id: string, note: string) => void;
  onEvidenceChange?: (id: string, urls: string[]) => void;
  disabled?: boolean;
  machineCode?: string;
}

export function CncChecklist({
  checks,
  onCheckChange,
  onNoteChange,
  onEvidenceChange,
  disabled = false,
  machineCode = "CNC",
}: CncChecklistProps) {
  // Collapsed observation states
  const [openNotes, setOpenNotes] = React.useState<Record<string, boolean>>({});
  // File upload state per item
  const [uploadingCheckId, setUploadingCheckId] = React.useState<string | null>(null);
  const [uploadError, setUploadError] = React.useState<Record<string, string>>({});
  // Image lightbox preview
  const [previewImage, setPreviewImage] = React.useState<string | null>(null);

  const fileInputRefs = React.useRef<Record<string, HTMLInputElement | null>>({});

  const toggleNote = (id: string) => {
    setOpenNotes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const groups = React.useMemo(() => {
    const list: { name: string; items: CheckDefinition[] }[] = [];
    for (const c of CHECKS) {
      let g = list.find((x) => x.name === c.group);
      if (!g) {
        g = { name: c.group, items: [] };
        list.push(g);
      }
      g.items.push(c);
    }
    return list;
  }, []);

  const handleFileUpload = async (checkId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCheckId(checkId);
    setUploadError((prev) => ({ ...prev, [checkId]: "" }));

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("machineCode", machineCode);

      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al subir la imagen");
      }

      const currentUrls = checks[checkId]?.evidenceUrls || [];
      const updatedUrls = [...currentUrls, data.url];
      if (onEvidenceChange) {
        onEvidenceChange(checkId, updatedUrls);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al subir imagen";
      setUploadError((prev) => ({ ...prev, [checkId]: message }));
    } finally {
      setUploadingCheckId(null);
      if (fileInputRefs.current[checkId]) {
        fileInputRefs.current[checkId]!.value = "";
      }
    }
  };

  const handleRemovePhoto = (checkId: string, indexToRemove: number) => {
    const currentUrls = checks[checkId]?.evidenceUrls || [];
    const updatedUrls = currentUrls.filter((_, idx) => idx !== indexToRemove);
    if (onEvidenceChange) {
      onEvidenceChange(checkId, updatedUrls);
    }
  };

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const groupOk = group.items.filter((c) => checks[c.id]?.value === "ok").length;
        const groupFaults = group.items.filter((c) => checks[c.id]?.value === "fault").length;

        return (
          <div key={group.name} className="space-y-3">
            {/* Group Header */}
            <div className="flex items-center justify-between border-b border-border/80 pb-2">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <span>{group.name}</span>
                {groupFaults > 0 && (
                  <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                    {groupFaults} anomalía(s)
                  </Badge>
                )}
              </h3>
              <span className="text-xs font-mono text-muted-foreground">
                {groupOk} / {group.items.length} conformes
              </span>
            </div>

            {/* Group Items */}
            <div className="grid grid-cols-1 gap-3">
              {group.items.map((check) => {
                const entry = checks[check.id] || { value: "pending", note: "", evidenceUrls: [] };
                const isOk = entry.value === "ok";
                const isFault = entry.value === "fault";
                const isPending = entry.value === "pending";
                const hasNote = !!entry.note?.trim();
                const noteOpen = isFault || openNotes[check.id] || hasNote;
                const checkIndex = CHECKS.indexOf(check) + 1;
                const evidenceList = entry.evidenceUrls || [];
                const isUploading = uploadingCheckId === check.id;

                return (
                  <div
                    key={check.id}
                    className={`rounded-xl border p-4 transition-all ${
                      isFault
                        ? "border-destructive/40 bg-destructive/5"
                        : isOk
                        ? "border-border/80 bg-card hover:border-border"
                        : "border-border/60 bg-card/60"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="flex size-7 items-center justify-center rounded-lg bg-muted/60 font-mono text-xs font-bold text-muted-foreground shrink-0 mt-0.5">
                          {String(checkIndex).padStart(2, "0")}
                        </span>

                        <div className="space-y-1 min-w-0">
                          <h4 className="font-semibold text-sm text-foreground leading-snug">
                            {check.title}
                          </h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {check.detail}
                          </p>
                          <span className="text-[10px] text-muted-foreground/80 block pt-0.5">
                            {check.source}
                          </span>
                        </div>
                      </div>

                      {/* State Button Group */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-start pt-1 sm:pt-0">
                        <Button
                          type="button"
                          size="sm"
                          disabled={disabled}
                          onClick={() => onCheckChange(check.id, "ok")}
                          className={`h-8 text-xs gap-1.5 transition-all ${
                            isOk
                              ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          <CheckCircle2 className="size-3.5" />
                          <span>Conforme</span>
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          disabled={disabled}
                          onClick={() => onCheckChange(check.id, "fault")}
                          className={`h-8 text-xs gap-1.5 transition-all ${
                            isFault
                              ? "bg-destructive text-white hover:bg-destructive/90 shadow-sm"
                              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          <AlertOctagon className="size-3.5" />
                          <span>Anomalía</span>
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          disabled={disabled}
                          onClick={() => onCheckChange(check.id, "pending")}
                          className={`h-8 text-xs gap-1 transition-all ${
                            isPending
                              ? "bg-secondary text-secondary-foreground shadow-xs"
                              : "bg-muted/30 text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          <HelpCircle className="size-3.5" />
                          <span>Pendiente</span>
                        </Button>
                      </div>
                    </div>

                    {/* Observación expandible y Evidencia Fotográfica */}
                    <div className="mt-2 pt-2 border-t border-border/40">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => toggleNote(check.id)}
                          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <MessageSquare className="size-3" />
                          <span>
                            {noteOpen
                              ? "Ocultar observación y fotos"
                              : hasNote || evidenceList.length > 0
                              ? `Ver observación (${evidenceList.length} fotos)`
                              : "Añadir observación"}
                          </span>
                          {noteOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                        </button>

                        {isFault && evidenceList.length === 0 && (
                          <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">
                            Foto requerida
                          </Badge>
                        )}
                      </div>

                      {noteOpen && (
                        <div className="pt-2 space-y-3">
                          <Textarea
                            rows={2}
                            placeholder={
                              isFault
                                ? "Describa detalladamente la anomalía encontrada (mínimo 5 caracteres)..."
                                : "Hallazgo o acción preventiva realizada..."
                            }
                            value={entry.note || ""}
                            onChange={(e) => onNoteChange(check.id, e.target.value)}
                            disabled={disabled}
                            className={`text-xs min-h-[50px] ${
                              isFault && (!entry.note || entry.note.trim().length < 5)
                                ? "border-destructive/60 focus-visible:ring-destructive"
                                : ""
                            }`}
                          />

                          {/* Sección de Evidencia Fotográfica */}
                          <div className="p-2.5 rounded-lg bg-muted/20 border border-border/60 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[11px] font-medium text-foreground flex items-center gap-1">
                                <Camera className="size-3.5 text-primary" />
                                <span>Evidencia Fotográfica {isFault ? "(Obligatoria)" : "(Opcional)"}</span>
                              </span>

                              <div>
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp"
                                  capture="environment"
                                  className="hidden"
                                  ref={(el) => {
                                    fileInputRefs.current[check.id] = el;
                                  }}
                                  onChange={(e) => handleFileUpload(check.id, e)}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={disabled || isUploading}
                                  onClick={() => fileInputRefs.current[check.id]?.click()}
                                  className="h-7 text-xs gap-1.5"
                                >
                                  {isUploading ? (
                                    <>
                                      <Loader2 className="size-3 animate-spin" />
                                      <span>Subiendo...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Camera className="size-3" />
                                      <span>Adjuntar foto</span>
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>

                            {uploadError[check.id] && (
                              <p className="text-[10px] text-destructive">{uploadError[check.id]}</p>
                            )}

                            {/* Galería de miniaturas */}
                            {evidenceList.length > 0 ? (
                              <div className="flex flex-wrap gap-2 pt-1">
                                {evidenceList.map((url, idx) => (
                                  <div
                                    key={idx}
                                    className="relative group size-14 rounded-lg overflow-hidden border border-border/80 bg-background shrink-0 shadow-xs"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={url}
                                      alt={`Evidencia ${idx + 1}`}
                                      className="size-full object-cover cursor-pointer hover:scale-105 transition-transform"
                                      onClick={() => setPreviewImage(url)}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setPreviewImage(url)}
                                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                                      title="Ver foto"
                                    >
                                      <ZoomIn className="size-3.5" />
                                    </button>
                                    {!disabled && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRemovePhoto(check.id, idx);
                                        }}
                                        className="absolute top-0.5 right-0.5 size-4 rounded-full bg-destructive text-white flex items-center justify-center hover:bg-destructive/90 shadow-sm"
                                        title="Eliminar foto"
                                      >
                                        <X className="size-2.5" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : isFault ? (
                              <p className="text-[10px] text-destructive/80 italic">
                                Debe adjuntar al menos una foto clara de la anomalía para permitir el cierre del turno.
                              </p>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Modal de previsualización en grande */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-2xl p-2 bg-black/90 border-border text-white">
          <DialogHeader className="p-2 border-b border-white/10">
            <DialogTitle className="text-sm font-semibold flex items-center justify-between text-white">
              <span>Evidencia Fotográfica de Anomalía</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-2">
            {previewImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewImage}
                alt="Vista previa evidencia"
                className="max-h-[75vh] w-auto max-w-full rounded-md object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
