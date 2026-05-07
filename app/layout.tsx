import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/bottom-nav";
import Navbar from "@/components/navbar";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import { Toaster } from "sonner";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "دولابي — سوق الموضة المستعملة في ليبيا",
  description: "اشتر وبع الملابس والإكسسوارات المستعملة في ليبيا",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "دولابي",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

/* Required for env(safe-area-inset-bottom) to work on iOS notched devices */
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#5D2A42",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} h-full antialiased`}
    >
      {/*
        pb-20 md:pb-0 — creates space so page content isn't hidden
        behind the fixed BottomNav on mobile; removed on md+ where
        the nav is hidden.
      */}
      <body className="min-h-full flex flex-col font-sans pb-20 md:pb-0">
        <Navbar />
        {/*
          md:pt-16 offsets the 64px (h-16) desktop Navbar row so inner-page
          sticky sub-headers don't slide behind it on large screens.
          Mobile Navbar is h-14 (sticky, takes flow space), no extra offset needed.
        */}
        <div className="flex-1 md:pt-16">
          {children}
        </div>
        <BottomNav />
        <Toaster position="top-center" dir="rtl" richColors />
        <ServiceWorkerRegistration />
        <PwaInstallPrompt />
      </body>
    </html>
  );
}
