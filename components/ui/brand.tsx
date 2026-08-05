"use client";

import Image from "next/image";
import glucofinityMark from "@/public/glucofinity-mark-transparent.png";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="GlucoFinity">
      <span className="relative h-8 w-12 shrink-0 overflow-hidden rounded-md" aria-hidden="true">
        <Image src={glucofinityMark} alt="" fill sizes="48px" className="scale-[1.55] object-contain" />
      </span>
      <span className={compact ? "text-[1.05rem] font-semibold text-[#0b1f33]" : "text-[1.15rem] font-semibold text-[#0b1f33]"}>
        Gluco<span className="text-[#1268e8]">Finity</span>
      </span>
    </span>
  );
}
