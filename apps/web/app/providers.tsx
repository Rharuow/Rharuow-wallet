"use client";

import { ToasterProvider } from "rharuow-ds";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToasterProvider position="top-right" maxToasts={5}>
      {children}
    </ToasterProvider>
  );
}
