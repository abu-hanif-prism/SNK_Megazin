import type { Metadata, Viewport } from "next";
import { ReactNode } from "react";
import { ToastProvider } from "@/core/toast";
import { FlowProvider } from "@/print-flow/flow-state";
import { AppShell } from "./AppShell";
import "./globals.scss";

export const metadata: Metadata = {
  title: "SnapNkeep",
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <FlowProvider>
            <AppShell>{children}</AppShell>
          </FlowProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
