import type { Metadata } from "next";
import { DashboardHome } from "../components/dashboard/dashboard-home";

export const metadata: Metadata = {
  title: "Dashboard | DS-HR",
};

export default function Home() {
  return <main><DashboardHome /></main>;
}
