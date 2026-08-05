import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { DemoApp } from "@/components/demo/demo-app";
import { Brand } from "@/components/ui/brand";

export const metadata: Metadata = {
  title: "Interactive Demo | GlucoFinity",
  description: "Explore GlucoFinity with deterministic fictional glucose and meal data in a session-only educational prototype.",
};

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-[#f4f7fa]">
      <a href="#demo-main" className="skip-link">Skip to demo</a>
      <header className="sticky top-0 z-50 border-b border-[#dce5ee] bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#526477] hover:text-[#1268e8]" aria-label="Back to GlucoFinity home">
              <ArrowLeft className="size-4" aria-hidden="true" /> <span className="hidden sm:inline">Back</span>
            </Link>
            <span className="h-7 w-px bg-[#dce5ee]" aria-hidden="true" />
            <Brand compact />
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#cddceb] bg-[#f7fafc] px-3 py-1.5 text-xs font-semibold text-[#31506f]">
            <FlaskConical className="size-3.5 text-[#1268e8]" aria-hidden="true" /> Interactive educational prototype
          </div>
        </div>
      </header>
      <main id="demo-main">
        <DemoApp />
      </main>
      <footer className="border-t border-[#dce5ee] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-xs leading-5 text-[#64768a] sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p>All readings, meals, calculations, and observations are fictional prototype content.</p>
          <p>Not for diagnosis, treatment, medication, or insulin decisions.</p>
        </div>
      </footer>
    </div>
  );
}
