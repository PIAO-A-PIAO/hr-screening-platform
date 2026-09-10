import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | DS-HR",
};

export default function Home() {
  return <main className="dashboardCanvas" aria-label="DS-HR dashboard" />;
}