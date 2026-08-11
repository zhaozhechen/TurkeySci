import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
