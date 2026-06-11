import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dopamine Summer",
  description: "A playful DeFi summer farming arcade with fake LP assets and real wallet nostalgia.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true
    }
  },
  openGraph: {
    title: "Dopamine Summer",
    description: "Fake liquidity. Real contracts. Zero financial advice. Maximum 2020 energy."
  },
  twitter: {
    card: "summary",
    title: "Dopamine Summer",
    description: "Fake liquidity. Real contracts. Zero financial advice. Maximum 2020 energy."
  }
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
