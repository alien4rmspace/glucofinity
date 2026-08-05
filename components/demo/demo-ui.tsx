import type { ReactNode } from "react";

export function DemoCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-[#dce5ee] bg-white ${className}`}>
      {children}
    </div>
  );
}

export function DemoSectionHeading({
  id,
  title,
  description,
  action,
}: {
  id?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 id={id} className="text-xl font-semibold text-[#0b1f33]">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#64768a]">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function DemoMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <DemoCard className="min-w-0 p-4 sm:p-5">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#718096]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[#0b1f33]">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[#718096]">{helper}</p>
    </DemoCard>
  );
}

export function DemoNotice({
  icon,
  title,
  children,
  tone = "blue",
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  tone?: "blue" | "purple" | "amber" | "neutral";
}) {
  const tones = {
    blue: "border-[#cfe0f3] bg-[#eff6ff] text-[#0e5ab7]",
    purple: "border-[#ddd5fb] bg-[#f5f2ff] text-[#6049bc]",
    amber: "border-[#ecd9b4] bg-[#fff9ec] text-[#8b570d]",
    neutral: "border-[#dce5ee] bg-[#f7fafc] text-[#34495e]",
  };

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-4 ${tones[tone]}`}>
      <span className="mt-0.5 shrink-0" aria-hidden="true">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <div className="mt-1 text-xs leading-5 text-[#526477]">{children}</div>
      </div>
    </div>
  );
}

export function DemoEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <DemoCard className="grid min-h-64 place-items-center p-6 text-center">
      <div className="max-w-md">
        <h2 className="text-xl font-semibold text-[#0b1f33]">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-[#64768a]">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </DemoCard>
  );
}
