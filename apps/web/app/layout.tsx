import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DS-HR",
  description: "Digital Shovel's internal hiring platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
