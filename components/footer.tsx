import { Brand } from "@/components/ui/brand";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-[#dce5ee] bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-7 px-4 py-10 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
        <div className="max-w-xl"><Brand compact /><p className="mt-4 text-sm leading-6 text-[#718096]">An educational university project prototype. Not for diagnosis, treatment, or medication decisions.</p><p className="mt-3 text-xs text-[#8a9aac]">&copy; {year} GlucoFinity project.</p></div>
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-[#526477]"><a href="#safety" className="hover:text-[#1268e8]">Safety</a><a href="#about" className="hover:text-[#1268e8]">About</a><a href="#technology" className="hover:text-[#1268e8]">Technology</a><a href="#privacy" className="hover:text-[#1268e8]">Privacy</a></nav>
      </div>
      <div id="privacy" className="scroll-mt-20 border-t border-[#e4ebf2] bg-[#f7fafc] px-4 py-4 text-center text-xs leading-5 text-[#718096]">Privacy direction: any future product would require explicit consent, data minimization, secure storage, and transparent controls before handling personal health information.</div>
    </footer>
  );
}
