import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BotVisibility | How visible is your product to AI agents?",
  description:
    "Scan any URL and get your BotVisibility score in seconds. We check for llms.txt, agent-card.json, OpenAPI specs, CORS headers, and more.",
  openGraph: {
    title: "BotVisibility",
    description: "How visible is your product to AI agents? Scan any URL and find out.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BotVisibility",
    description: "How visible is your product to AI agents? Scan any URL and find out.",
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
