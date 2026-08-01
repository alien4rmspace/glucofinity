type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
  align?: "left" | "center";
};

export function SectionHeading({ eyebrow, title, description, align = "left" }: SectionHeadingProps) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-2xl"}>
      <p className="mb-3 text-xs font-bold uppercase text-[#1268e8]">{eyebrow}</p>
      <h2 className="text-3xl font-semibold text-[#0b1f33] sm:text-4xl">{title}</h2>
      <p className="mt-4 text-base leading-7 text-[#526477] sm:text-lg">{description}</p>
    </div>
  );
}
