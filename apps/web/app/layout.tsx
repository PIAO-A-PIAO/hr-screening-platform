import type { Metadata } from "next";
import { AppChrome } from "../components/AppChrome";
import "./globals.css";

export const metadata: Metadata = {
  title: "Interview Desk",
  description: "Internal asynchronous interview and review portal",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
