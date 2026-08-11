import type { Metadata } from "next";
import { DM_Mono, Instrument_Serif, Manrope } from "next/font/google";
import "./globals.css";

const sans = Manrope({ variable: "--font-sans", subsets: ["latin"] });
const serif = Instrument_Serif({ variable: "--font-serif", subsets: ["latin"], weight: "400" });
const mono = DM_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "TurkeySci | Kīlauea eruption timing model",
  description: "An automatically updated Bayesian view of Kīlauea's next lava-fountaining episode, based on official USGS forecast windows.",
  metadataBase: new URL("https://turkeysci-kilauea.endlessczz.chatgpt.site"),
  authors: [{ name: "Endlessczz" }],
  icons: { icon: "/turkeysci-logo.png", shortcut: "/turkeysci-logo.png" },
  openGraph: {
    title: "TurkeySci · Kīlauea eruption timing",
    description: "A transparent Bayesian outlook, automatically updated from USGS forecast windows.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${serif.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
