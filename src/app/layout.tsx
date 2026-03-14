import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Agent-Readiness Scanner | Is your app ready for AI agents?",
  description:
    "Scan any URL to check if it's ready for AI agents. We check for llms.txt, agent-card.json, OpenAPI specs, and 30+ other agent-readiness signals.",
  openGraph: {
    title: "Agent-Readiness Scanner",
    description: "Scan any URL to check if it's ready for AI agents. llms.txt, agent-card.json, OpenAPI specs, and more.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Agent-Readiness Scanner",
    description: "Scan any URL to check if it's ready for AI agents. llms.txt, agent-card.json, OpenAPI specs, and more.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
