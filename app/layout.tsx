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
const siteUrl = `https://alien4rmspace.github.io${basePath}`;

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
    description: "Discover the possibilities within your glucose data.",
    type: "website",
    url: siteUrl,
    images: [
      {
        url: `${siteUrl}/og.png`,
        width: 1680,
        height: 941,
        alt: "GlucoFinity glucose pattern dashboard preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GlucoFinity",
    description: "Discover the possibilities within your glucose data.",
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
