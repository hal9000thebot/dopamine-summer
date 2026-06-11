import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://dopaminesummer.xyz";
const siteTitle = "Dopamine Summer | Fake DeFi Farming, Real DOPAMINE";
const siteDescription =
  "A cursed DeFi Summer simulator: fake LP assets, excessive clicking, real Base contracts, and DOPAMINE with no promised value.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: "%s | Dopamine Summer"
  },
  description: siteDescription,
  applicationName: "Dopamine Summer",
  authors: [{ name: "vanzooeth", url: "https://x.com/vanzooeth" }],
  creator: "vanzooeth",
  publisher: "vanzooeth",
  keywords: [
    "Dopamine Summer",
    "DOPAMINE",
    "DeFi Summer",
    "Base",
    "DeFi farming",
    "onchain game",
    "meme token"
  ],
  alternates: {
    canonical: "/"
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon.svg", type: "image/svg+xml" }
    ],
    shortcut: "/favicon.svg",
    apple: "/icon.svg"
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1
    }
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Dopamine Summer",
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Dopamine Summer fake DeFi farming simulator"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    site: "@vanzooeth",
    creator: "@vanzooeth",
    title: siteTitle,
    description: siteDescription,
    images: ["/opengraph-image"]
  }
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
