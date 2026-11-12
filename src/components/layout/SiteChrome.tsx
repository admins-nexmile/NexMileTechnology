import type { ReactNode } from "react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { MotionProvider } from "@/components/providers/MotionProvider";

/** Marketing-site header, main landmark and footer. */
export function SiteChrome({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only z-[60] rounded-full bg-navy-800 px-5 py-3 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>
      <MotionProvider>
        <Header />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer />
      </MotionProvider>
    </>
  );
}
