import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/ui/brand";

type LegalPageShellProps = {
  eyebrow: string;
  title: string;
  intro: string;
  updated: string;
  children: ReactNode;
};

export function LegalPageShell({
  eyebrow,
  title,
  intro,
  updated,
  children,
}: LegalPageShellProps) {
  return (
    <div className="min-h-screen bg-[#f4f7fa]">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <header className="border-b border-[#dce5ee] bg-white">
        <div className="mx-auto flex min-h-16 max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" aria-label="GlucoFinity home">
            <Brand compact />
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[#526477] hover:bg-[#f2f7fb] hover:text-[#1268e8]"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to GlucoFinity
          </Link>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1268e8]">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#0b1f33] sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 text-base leading-7 text-[#526477] sm:text-lg">{intro}</p>
          <p className="mt-4 text-sm font-medium text-[#718096]">Last updated: {updated}</p>
        </div>

        <article className="legal-content mt-10 overflow-hidden rounded-lg border border-[#dce5ee] bg-white px-5 py-2 shadow-[0_12px_32px_rgba(31,58,77,0.06)] sm:px-8">
          {children}
        </article>
      </main>

      <footer className="border-t border-[#dce5ee] bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8 text-sm text-[#64768a] sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <p>GlucoFinity is educational and does not replace professional care.</p>
          <nav aria-label="Legal navigation" className="flex flex-wrap gap-x-6 gap-y-3 font-semibold">
            <Link href="/" className="hover:text-[#1268e8]">Home</Link>
            <Link href="/privacy" className="hover:text-[#1268e8]">Privacy</Link>
            <Link href="/support" className="hover:text-[#1268e8]">Support</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
