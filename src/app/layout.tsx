import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";

import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

// Self-hosted by next/font at build time: no request to Google from a visitor's browser.
const body = DM_Sans({ subsets: ["latin"], variable: "--ff-body", display: "swap" });
const display = Fraunces({
  subsets: ["latin"],
  variable: "--ff-display",
  display: "swap",
  axes: ["SOFT", "opsz"],
});

export const metadata: Metadata = {
  title: "Rasoi",
  description: "Your recipe book: dishes, their parts, and every ingredient with a photo",
  applicationName: "Rasoi",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icon-192.png", sizes: "192x192" }],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: "Rasoi", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6efe3" },
    { media: "(prefers-color-scheme: dark)", color: "#1e1915" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable}`}>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
