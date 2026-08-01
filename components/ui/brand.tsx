"use client";

import { Activity } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="GlucoFinity">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#1268e8] text-white shadow-sm">
        <Activity aria-hidden="true" className="size-[18px]" strokeWidth={2.4} />
      </span>
      <span className={compact ? "text-[1.05rem] font-semibold text-[#0b1f33]" : "text-[1.15rem] font-semibold text-[#0b1f33]"}>
        Gluco<span className="text-[#1268e8]">Finity</span>
      </span>
    </span>
  );
}
