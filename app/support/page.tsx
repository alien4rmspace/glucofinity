import type { Metadata } from "next";
import { Activity, Bug, CircleHelp, ExternalLink, LifeBuoy, Mic, RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal-page-shell";

export const metadata: Metadata = {
  title: "Support | GlucoFinity",
  description:
    "Get help with GlucoFinity health permissions, voice meal entry, local data, and technical problems.",
};

const supportTopics = [
  {
    title: "Apple Health data is not appearing",
    icon: Activity,
    content:
      "Open GlucoFinity Settings, select Apple Health, and review access. GlucoFinity can only display permitted records already written to Apple Health by another app or device. A permission choice, missing source record, or delay from the source app can leave a range empty.",
  },
  {
    title: "Voice meal entry is unavailable",
    icon: Mic,
    content:
      "Voice meal entry requires a supported iPhone, microphone and speech permission, and completion of the initial local-model download. Keep the app open during first setup, confirm network access and free storage, then use the retry action if setup pauses.",
  },
  {
    title: "Delete locally stored information",
    icon: RotateCcw,
    content:
      "Delete individual logs from their detail screens, or open Settings and choose Reset local app data. Reset clears locally stored meals, medication logs, feeling check-ins, and preferences. It does not remove source records or permissions from Apple Health or Health Connect.",
  },
];

export default function SupportPage() {
  return (
    <LegalPageShell
      eyebrow="Help and contact"
      title="GlucoFinity Support"
      intro="Find help for common app questions or report a technical problem. GlucoFinity is an educational project, so support is provided on a best-effort basis and is not continuously monitored."
      updated="August 19, 2026"
    >
      <section className="legal-alert">
        <div className="flex gap-3">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-[#9a5b08]" aria-hidden="true" />
          <div>
            <h2 className="mt-0! text-lg!">Not for urgent or medical support</h2>
            <p>
              GlucoFinity does not monitor emergencies and cannot provide medical advice. If you
              may be experiencing an emergency, contact local emergency services. Ask a qualified
              healthcare professional before making medical, medication, or insulin decisions.
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-3">
          <CircleHelp className="size-5 text-[#1268e8]" aria-hidden="true" />
          <h2 className="mt-0!">Common questions</h2>
        </div>
        <div className="mt-5 grid gap-4">
          {supportTopics.map((topic) => {
            const Icon = topic.icon;
            return (
              <div key={topic.title} className="rounded-lg border border-[#dce5ee] bg-[#f8fbfd] p-5">
                <div className="flex gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#e7f1ff] text-[#1268e8]">
                    <Icon className="size-4.5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="mt-1!">{topic.title}</h3>
                    <p>{topic.content}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-3">
          <LifeBuoy className="size-5 text-[#1268e8]" aria-hidden="true" />
          <h2 className="mt-0!">Contact support</h2>
        </div>
        <p>
          Report a reproducible technical problem through the project&apos;s public GitHub issue
          tracker. Include the GlucoFinity app version and build number shown in Settings, your
          device and operating-system version, the steps you followed, and the result you expected.
        </p>
        <p>
          <strong>Do not post glucose readings, meal photos, medication details, names, contact
          information, or other personal health information in a public issue.</strong>
        </p>
        <a
          href="https://github.com/alien4rmspace/glucofinity/issues/new"
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#1268e8] px-5 text-sm font-semibold text-white hover:bg-[#0f57c3]"
        >
          <Bug className="size-4" aria-hidden="true" />
          Open a support request
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      </section>

      <section>
        <h2>Privacy questions</h2>
        <p>
          Read the <Link href="/privacy">GlucoFinity Privacy Policy</Link> for details about local
          storage, health permissions, voice processing, model downloads, and deletion. GlucoFinity
          has no user accounts or developer-operated health-data backend, so the developer does not
          have a server-side profile or app-log history to retrieve or delete.
        </p>
      </section>

      <section>
        <h2>Project information</h2>
        <p>
          GlucoFinity is developed by Damian Saelee as an educational university healthcare
          technology project. You can review the public project repository on{` `}
          <a href="https://github.com/alien4rmspace/glucofinity" target="_blank" rel="noreferrer">
            GitHub
          </a>.
        </p>
      </section>
    </LegalPageShell>
  );
}
