"use client";

import * as React from "react";
import {
  Server,
  Plus,
  QrCode,
  AlertTriangle,
  Loader2,
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
import { CncQrCardModal } from "./cnc-qr-card-modal";

export interface Machine {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  model: string | null;
  serialNumber: string | null;
  active: boolean;
  createdAt: string;
}

interface CncMachinesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  tenantName: string;
  maxMachines: number;
  machines: Machine[];
  onMachinesChange: () => void;
  logoUrl?: string | null;
}

export function CncMachinesModal({
  open,
  onOpenChange,
  slug,
  tenantName,
  maxMachines,
  machines,
  onMachinesChange,
  logoUrl,
}: CncMachinesModalProps) {
  // Creation form state
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [newCode, setNewCode] = React.useState("");
  const [newName, setNewName] = React.useState("");
  const [newModel, setNewModel] = React.useState("");
  const [newSerial, setNewSerial] = React.useState("");
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);

  // QR Modal preview state
  const [qrModalOpen, setQrModalOpen] = React.useState(false);
  const [selectedMachine, setSelectedMachine] = React.useState<Machine | null>(null);

  const activeCount = machines.filter((m) => m.active).length;
  const isAtLimit = activeCount >= maxMachines;

  const handleCreateMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newName) {
      setCreateError("Código y nombre son obligatorios.");
      return;
    }

    setCreateError(null);
    setIsCreating(true);

    try {
      const res = await fetch("/api/machines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newCode.trim().toUpperCase(),
          name: newName.trim(),
          model: newModel.trim() || null,
          serialNumber: newSerial.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "Error al registrar la máquina.");
        setIsCreating(false);
        return;
      }

      // Reset form
      setNewCode("");
      setNewName("");
      setNewModel("");
      setNewSerial("");
      setShowCreateForm(false);
      onMachinesChange();
    } catch {
      setCreateError("Error de red al registrar la máquina.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleActive = async (machine: Machine) => {
    const nextActive = !machine.active;
    try {
      const res = await fetch(`/api/machines/${machine.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextActive }),
      });

      if (res.ok) {
        onMachinesChange();
      }
    } catch (err) {
      console.error("Error al actualizar máquina:", err);
    }
  };

  const openQrPreview = (machine: Machine) => {
    setSelectedMachine(machine);
    setQrModalOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Server className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold">Máquinas y Códigos QR</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Gestión de equipos industriales y generación de identificadores para {tenantName}.
                  </DialogDescription>
                </div>
              </div>

              {/* Quota Badge */}
              <div className="flex items-center gap-2">
                <Badge
                  variant={isAtLimit ? "destructive" : "secondary"}
                  className="font-mono text-xs px-2.5 py-1"
                >
                  Cuota: {activeCount} / {maxMachines} activas
                </Badge>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            {/* Action Bar */}
            <div className="flex items-center justify-between border-b border-border pb-4">
              <span className="text-sm font-medium">Listado de Equipos CNC</span>
              {!showCreateForm && (
                <Button
                  size="sm"
                  onClick={() => setShowCreateForm(true)}
                  disabled={isAtLimit}
                  className="gap-1.5"
                >
                  <Plus className="size-4" />
                  <span>Nueva Máquina</span>
                </Button>
              )}
            </div>

            {/* Create Machine Form */}
            {showCreateForm && (
              <form
                onSubmit={handleCreateMachine}
                className="rounded-lg border border-border/80 bg-muted/20 p-4 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-primary">Registrar Nueva Máquina</span>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="m-code" className="text-xs">
                      Código Identificador *
                    </Label>
                    <Input
                      id="m-code"
                      placeholder="Ej. SF3015HM"
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="m-name" className="text-xs">
                      Nombre descriptivo *
                    </Label>
                    <Input
                      id="m-name"
                      placeholder="Ej. Senfeng Fibra 3kW"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="m-model" className="text-xs">
                      Modelo (Opcional)
                    </Label>
                    <Input
                      id="m-model"
                      placeholder="Ej. SF3015HM-G"
                      value={newModel}
                      onChange={(e) => setNewModel(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="m-serial" className="text-xs">
                      Número de Serie (Opcional)
                    </Label>
                    <Input
                      id="m-serial"
                      placeholder="Ej. SN-2024-8841"
                      value={newSerial}
                      onChange={(e) => setNewSerial(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreateForm(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" size="sm" disabled={isCreating} className="gap-2">
                    {isCreating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                    <span>Guardar Máquina</span>
                  </Button>
                </div>
              </form>
            )}

            {/* Machines Table */}
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre / Modelo</TableHead>
                    <TableHead>N° Serie</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right">Etiqueta QR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {machines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs">
                        No hay máquinas registradas en esta organización.
                      </TableCell>
                    </TableRow>
                  ) : (
                    machines.map((machine) => (
                      <TableRow key={machine.id} className="border-border hover:bg-muted/30">
                        <TableCell>
                          <span className="font-mono font-bold text-sm text-primary">
                            {machine.code}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{machine.name}</div>
                          {machine.model && (
                            <div className="text-xs text-muted-foreground">{machine.model}</div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {machine.serialNumber || "--"}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Switch
                              checked={machine.active}
                              onCheckedChange={() => handleToggleActive(machine)}
                              aria-label="Activar o desactivar máquina"
                            />
                            <span className="text-xs text-muted-foreground min-w-[50px]">
                              {machine.active ? "Activa" : "Inactiva"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openQrPreview(machine)}
                            className="gap-1.5 h-8 text-xs"
                          >
                            <QrCode className="size-3.5" />
                            <span>Etiqueta QR</span>
                          </Button>
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

      {/* QR Code Industrial Card Modal */}
      <CncQrCardModal
        open={qrModalOpen}
        onOpenChange={setQrModalOpen}
        machine={selectedMachine}
        slug={slug}
        tenantName={tenantName}
        logoUrl={logoUrl}
      />
    </>
  );
}
