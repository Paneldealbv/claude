import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import { themaScript } from "@/lib/thema";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Nieuwbouw Dashboard",
    template: "%s · Nieuwbouw Dashboard",
  },
  description:
    "Budgetten, offertes, facturen en bonnetjes van onze nieuwbouwwoning op één plek.",
  applicationName: "Nieuwbouw Dashboard",
  appleWebApp: {
    capable: true,
    title: "Nieuwbouw",
    statusBarStyle: "default",
  },
  icons: { apple: "/apple-touch-icon.png" },
  // Privé gegevens: nooit in zoekmachines.
  robots: { index: false, follow: false },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0d0f" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Nonce uit de Content Security Policy (zie proxy.ts) voor ons eigen script.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="nl"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: themaScript }}
        />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
