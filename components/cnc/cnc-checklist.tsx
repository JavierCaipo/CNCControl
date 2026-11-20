"use client";

import * as React from "react";
import { CheckCircle2, AlertOctagon, HelpCircle, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CHECKS, CheckDefinition, CheckValue, CheckEntry } from "@/lib/cnc-model";

interface CncChecklistProps {
  checks: Record<string, CheckEntry>;
  onCheckChange: (id: string, value: CheckValue) => void;
  onNoteChange: (id: string, note: string) => void;
  disabled?: boolean;
}

export function CncChecklist({
  checks,
  onCheckChange,
  onNoteChange,
  disabled = false,
}: CncChecklistProps) {
  // Collapsed observation states
  const [openNotes, setOpenNotes] = React.useState<Record<string, boolean>>({});

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
                const entry = checks[check.id] || { value: "pending", note: "" };
                const isOk = entry.value === "ok";
                const isFault = entry.value === "fault";
                const isPending = entry.value === "pending";
                const hasNote = !!entry.note?.trim();
                const noteOpen = openNotes[check.id] || hasNote;
                const checkIndex = CHECKS.indexOf(check) + 1;

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

                    {/* Observación expandible */}
                    <div className="mt-2 pt-2 border-t border-border/40">
                      <button
                        type="button"
                        onClick={() => toggleNote(check.id)}
                        className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <MessageSquare className="size-3" />
                        <span>{noteOpen ? "Ocultar observación" : hasNote ? "Ver observación" : "Añadir observación"}</span>
                        {noteOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                      </button>

                      {noteOpen && (
                        <div className="pt-2">
                          <Textarea
                            rows={2}
                            placeholder="Hallazgo, anomalía o acción preventiva realizada..."
                            value={entry.note || ""}
                            onChange={(e) => onNoteChange(check.id, e.target.value)}
                            disabled={disabled}
                            className="text-xs min-h-[50px]"
                          />
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
    </div>
  );
}

