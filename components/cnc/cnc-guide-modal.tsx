"use client";

import * as React from "react";
import { BookOpen, Search, Wrench } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { GUIDES } from "@/lib/cnc-model";

interface CncGuideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CncGuideModal({ open, onOpenChange }: CncGuideModalProps) {
  const [searchTerm, setSearchTerm] = React.useState("");

  const filteredGuides = GUIDES.filter((g) => {
    const term = searchTerm.toLowerCase();
    return (
      g.name.toLowerCase().includes(term) ||
      g.system.toLowerCase().includes(term) ||
      g.cause.toLowerCase().includes(term)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <BookOpen className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Guía de Uso y Alarmas</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Procedimientos recomendados del Manual V1 para resolución de problemas y calidad de corte.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar problema (rebaba, corte, boquilla, alarma)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {filteredGuides.map((guide) => (
              <div
                key={guide.id}
                className="rounded-lg border border-border bg-card p-4 space-y-2.5 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Wrench className="size-4 text-primary shrink-0" />
                    <span className="font-bold text-sm text-foreground">{guide.name}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {guide.system}
                  </Badge>
                </div>

                <div className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Causa probable:</strong> {guide.cause}
                </div>

                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-primary block">
                    Acciones recomendadas:
                  </span>
                  <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside pl-1">
                    {guide.actions.map((action, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar Guía
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
