import "./globals.css";
import type { Metadata, Viewport } from "next";
import { UserMenu } from "@/components/UserMenu";
import { HealthPing } from "@/components/HealthPing";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";

export const metadata: Metadata = {
  title: "JSC MECH FAB LLP PRODUCTION SYSTEM",
  description: "JSC MECH FAB LLP Manufacturing Control ERP – Shop Floor Edition",
  manifest: "/manifest.json",
  // Apple / iOS PWA support
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "JSC ERP",
  },
  // Favicon + home screen icons
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // theme-color matches manifest + user spec (#ffffff)
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#ffffff" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Apple PWA meta tags — required for iOS "Add to Home Screen" */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="JSC ERP" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        {/* Mobile web app meta */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="JSC ERP" />
      </head>
      <body className="bg-[#f8fafc] text-slate-900">
        {/* Service Worker registration — renders nothing, runs after load */}
        <ServiceWorkerRegistrar />
        <UserMenu />
        <HealthPing />
        {children}
      </body>
    </html>
  );
}
