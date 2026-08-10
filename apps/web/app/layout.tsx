import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DS-HR Foundation",
  description: "Clean Milestone 0 foundation for the internal interview platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
