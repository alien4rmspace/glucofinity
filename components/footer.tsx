import { Brand } from "@/components/ui/brand";
import Link from "next/link";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-[#dce5ee] bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-7 px-4 py-10 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
        <div className="max-w-xl"><Brand compact /><p className="mt-4 text-sm leading-6 text-[#718096]">An educational university project prototype. Not for diagnosis, treatment, or medication decisions.</p><p className="mt-3 text-xs text-[#8a9aac]">&copy; {year} GlucoFinity project.</p></div>
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-[#526477]"><a href="#safety" className="hover:text-[#1268e8]">Safety</a><a href="#about" className="hover:text-[#1268e8]">About</a><a href="#technology" className="hover:text-[#1268e8]">Technology</a><Link href="/privacy" className="hover:text-[#1268e8]">Privacy</Link><Link href="/support" className="hover:text-[#1268e8]">Support</Link></nav>
      </div>
      <div className="border-t border-[#e4ebf2] bg-[#f7fafc] px-4 py-4 text-center text-xs leading-5 text-[#718096]">Review how GlucoFinity handles health permissions, local app data, and on-device processing in the <Link href="/privacy" className="font-semibold text-[#526477] underline decoration-[#b7c5d3] underline-offset-2 hover:text-[#1268e8]">Privacy Policy</Link>.</div>
    </footer>
  );
}
