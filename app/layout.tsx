import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const basePath = "/glucofinity";
const siteUrl = `https://damiansaelee.com${basePath}`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "GlucoFinity | Understand Your Glucose Patterns",
  description:
    "A university healthcare technology prototype exploring how meals, sleep, activity, and medication relate to glucose patterns.",
  icons: {
    icon: `${basePath}/favicon.svg`,
    shortcut: `${basePath}/favicon.svg`,
  },
  openGraph: {
    title: "GlucoFinity",
    description: "Evidence-backed, reviewable AI/ML foundations for glucose patterns.",
    type: "website",
    url: siteUrl,
    images: [
      {
        url: `${siteUrl}/og.png`,
        width: 1536,
        height: 1024,
        alt: "GlucoFinity evidence-first AI and glucose pattern architecture",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GlucoFinity",
    description: "Evidence-backed, reviewable AI/ML foundations for glucose patterns.",
    images: [`${siteUrl}/og.png`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
