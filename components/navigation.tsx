"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Brand } from "@/components/ui/brand";

const links = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Insights", href: "#insights" },
  { label: "About", href: "#about" },
];

export function Navigation() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-[#dce5ee] bg-white/95 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8" aria-label="Primary navigation">
        <a href="#top" onClick={() => setOpen(false)}><Brand compact /></a>
        <div className="hidden items-center gap-7 md:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="text-sm font-medium text-[#526477] transition-colors hover:text-[#1268e8]">{link.label}</a>
          ))}
          <a href="#demo" className="inline-flex h-10 items-center justify-center rounded-lg bg-[#1268e8] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0f57c3]">View Demo</a>
        </div>
        <button
          type="button"
          className="grid size-10 place-items-center rounded-lg border border-[#dce5ee] text-[#0b1f33] md:hidden"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>
      {open ? (
        <div id="mobile-navigation" className="border-t border-[#dce5ee] bg-white px-4 pb-5 pt-3 md:hidden">
          <div className="mx-auto grid max-w-7xl gap-1">
            {links.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-base font-medium text-[#34495e] hover:bg-[#f2f7fb] hover:text-[#1268e8]">{link.label}</a>
            ))}
            <a href="#demo" onClick={() => setOpen(false)} className="mt-2 inline-flex h-11 items-center justify-center rounded-lg bg-[#1268e8] px-4 text-sm font-semibold text-white">View Demo</a>
          </div>
        </div>
      ) : null}
    </header>
  );
}
