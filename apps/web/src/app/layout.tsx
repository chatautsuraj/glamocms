import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Outfit } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { ServiceWorkerRegister } from "@/components/providers/sw-register";
import "./globals.css";

const outfit = Outfit({ variable: "--font-glamo-sans", subsets: ["latin"], display: "swap", preload: true });
const cormorant = Cormorant_Garamond({ variable: "--font-glamo-display", subsets: ["latin"], weight: ["600", "700"], display: "swap", preload: true });

export const metadata: Metadata = {
  title: { default: "GLAMO POS", template: "%s · GLAMO POS" },
  description: "GLAMO Nepal point of sale and commerce cockpit",
  icons: { icon: "/favicon.ico" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#9f2d4a" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${outfit.variable} ${cormorant.variable} min-h-screen font-sans antialiased`}>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[100] focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:shadow">
          Skip to content
        </a>
        <ThemeProvider>
          <AuthProvider>
            {children}
            <Toaster position="top-right" richColors closeButton toastOptions={{ classNames: { toast: "rounded-xl border border-border shadow-lg" } }} />
          </AuthProvider>
        </ThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
