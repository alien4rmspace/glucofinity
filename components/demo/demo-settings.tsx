"use client";

import { Database, HeartPulse, Info, RotateCcw, ShieldCheck } from "lucide-react";
import { type FormEvent, useState } from "react";
import { DemoCard, DemoNotice, DemoSectionHeading } from "@/components/demo/demo-ui";
import { defaultDemoSettings } from "@/data/demo-data";
import type { DemoSettings } from "@/types/demo";

export function DemoSettingsPanel({
  settings,
  onChange,
  onReset,
}: {
  settings: DemoSettings;
  onChange: (settings: DemoSettings) => void;
  onReset: () => void;
}) {
  const [low, setLow] = useState(String(settings.targetLow));
  const [high, setHigh] = useState(String(settings.targetHigh));
  const [message, setMessage] = useState("");

  function saveRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetLow = Number(low);
    const targetHigh = Number(high);
    if (!Number.isFinite(targetLow) || !Number.isFinite(targetHigh) || targetLow < 40 || targetHigh > 400 || targetLow >= targetHigh) {
      setMessage("Enter a lower value of at least 40 and a higher value up to 400 mg/dL.");
      return;
    }
    onChange({ ...settings, targetLow, targetHigh });
    setMessage("Prototype range updated for this browser session.");
  }

  function confirmReset() {
    if (window.confirm("Reset session-only meals and settings to the fictional defaults?")) {
      setLow(String(defaultDemoSettings.targetLow));
      setHigh(String(defaultDemoSettings.targetHigh));
      onReset();
      setMessage("The interactive demo was reset.");
    }
  }

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1268e8]">Settings</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#0b1f33] sm:text-4xl">Data sources and display</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#64768a]">Explore interface preferences without connecting an account, sensor, or health-data source.</p>
      </div>

      <section className="grid gap-4" aria-labelledby="data-source-heading">
        <DemoSectionHeading id="data-source-heading" title="Data source" />
        <DemoCard className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#fff1f1] text-[#b33f3f]"><HeartPulse className="size-5" aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-[#0b1f33]">Apple Health</h3><span className="text-xs font-semibold text-[#b33f3f]">Not connected</span></div>
              <p className="mt-2 text-sm leading-6 text-[#64768a]">HealthKit requires native permissions and an iOS build. It is not available in this static website or standard Expo Go.</p>
              <button type="button" disabled className="mt-4 h-10 cursor-not-allowed rounded-lg border border-[#dce5ee] bg-[#f7fafc] px-4 text-xs font-semibold text-[#8a9aac]">Connect Apple Health — unavailable</button>
            </div>
          </div>
        </DemoCard>
      </section>

      <section className="grid gap-4" aria-labelledby="display-heading">
        <DemoSectionHeading id="display-heading" title="Glucose display" description="Prototype context only, not an individualized recommendation." />
        <DemoCard className="p-5 sm:p-6">
          <form onSubmit={saveRange} className="grid gap-5">
            <div className="flex items-center justify-between gap-4 border-b border-[#e4ebf2] pb-4"><span className="font-semibold text-[#0b1f33]">Units</span><span className="text-sm text-[#64768a]">mg/dL</span></div>
            <fieldset>
              <legend className="font-semibold text-[#0b1f33]">Prototype target range</legend>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-semibold text-[#34495e]">Lower value<input type="number" min="40" max="399" value={low} onChange={(event) => setLow(event.target.value)} className="h-11 rounded-lg border border-[#cbd8e4] px-3 font-normal text-[#0b1f33]" /></label>
                <label className="grid gap-1.5 text-sm font-semibold text-[#34495e]">Upper value<input type="number" min="41" max="400" value={high} onChange={(event) => setHigh(event.target.value)} className="h-11 rounded-lg border border-[#cbd8e4] px-3 font-normal text-[#0b1f33]" /></label>
              </div>
            </fieldset>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="min-h-5 text-xs text-[#64768a]" aria-live="polite">{message}</p>
              <button type="submit" className="h-10 rounded-lg bg-[#1268e8] px-4 text-sm font-semibold text-white hover:bg-[#0f57c3]">Save range</button>
            </div>
          </form>
        </DemoCard>
      </section>

      <section className="grid gap-4" aria-labelledby="prototype-data-heading">
        <DemoSectionHeading id="prototype-data-heading" title="Prototype data" />
        <DemoCard className="p-5 sm:p-6">
          <label className="flex cursor-pointer items-center gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#e5f8fb] text-[#147b8c]"><Database className="size-5" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1"><span className="block font-semibold text-[#0b1f33]">Show mock glucose data</span><span className="mt-1 block text-xs leading-5 text-[#64768a]">Deterministic fictional readings for this public demonstration.</span></span>
            <input type="checkbox" role="switch" checked={settings.showMockData} onChange={(event) => onChange({ ...settings, showMockData: event.target.checked })} className="size-5 accent-[#1268e8]" />
          </label>
        </DemoCard>
      </section>

      <DemoNotice icon={<Info className="size-5" />} title="Data and privacy" tone="purple">
        Session meal entries and display preferences stay in this open browser tab and reset on refresh. Do not enter real personal health information into this public prototype.
      </DemoNotice>

      <section className="grid gap-4" aria-labelledby="safety-settings-heading">
        <DemoSectionHeading id="safety-settings-heading" title="Safety and session data" />
        <DemoCard className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#edf5ff] text-[#1268e8]"><ShieldCheck className="size-5" aria-hidden="true" /></span>
            <div className="min-w-0 flex-1"><h3 className="font-semibold text-[#0b1f33]">Medical disclaimer</h3><p className="mt-2 text-sm leading-6 text-[#64768a]">GlucoFinity is educational and informational. It does not diagnose, prescribe treatment, recommend insulin doses, or replace a qualified healthcare professional.</p></div>
          </div>
          <div className="mt-5 border-t border-[#e4ebf2] pt-5">
            <button type="button" onClick={confirmReset} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#e5c8c8] px-4 text-sm font-semibold text-[#a43b3b] hover:bg-[#fff1f1]"><RotateCcw className="size-4" aria-hidden="true" />Reset interactive demo</button>
          </div>
        </DemoCard>
      </section>
    </div>
  );
}
