import { Footer } from "@/components/footer";
import { Navigation } from "@/components/navigation";
import { Features } from "@/components/sections/features";
import { Hero } from "@/components/sections/hero";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Insights } from "@/components/sections/insights";
import { MealAnalysis } from "@/components/sections/meal-analysis";
import { SafetyAboutCta } from "@/components/sections/safety-about-cta";
import { Technology } from "@/components/sections/technology";

export default function Home() {
  return (
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Navigation />
      <main id="main-content">
        <Hero />
        <Features />
        <HowItWorks />
        <MealAnalysis />
        <Insights />
        <Technology />
        <SafetyAboutCta />
      </main>
      <Footer />
    </>
  );
}
