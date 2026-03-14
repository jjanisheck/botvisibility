import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Agent-Readiness Audit | Is your app ready for AI agents?",
  description:
    "Score your app across 31 items to see how ready it is for the age of AI agents. From discoverable to agent-native.",
  openGraph: {
    title: "Agent-Readiness Audit",
    description: "Is your app ready for the age of AI agents? Score yourself and find out.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Agent-Readiness Audit",
    description: "Is your app ready for the age of AI agents? Score yourself and find out.",
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
