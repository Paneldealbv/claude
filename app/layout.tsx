import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
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
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0d0f" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="nl"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themaScript }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
