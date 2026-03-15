import type { Metadata } from "next";
import Script from "next/script";
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
        {/* Space Grotesk — bold, geometric, neo-brutalist */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-GMCLP028CY"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-GMCLP028CY');
          `}
        </Script>
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
