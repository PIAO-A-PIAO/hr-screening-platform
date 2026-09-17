import type { Metadata } from "next";
import { ApplicationFrame } from "../components/layout/application-frame";
import "../styles/design-tokens.css";
import "../styles/ui-components.css";
import "../styles/recruiter-shell.css";
import "../styles/positions-dashboard.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "DS-HR",
  description: "Digital Shovel's internal hiring platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body><ApplicationFrame>{children}</ApplicationFrame></body>
    </html>
  );
}
