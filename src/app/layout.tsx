import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <head>
        {/* Instrument Sans — distinctive, modern, not Inter */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
