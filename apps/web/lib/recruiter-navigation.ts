export type RecruiterNavIcon =
  | "dashboard"
  | "positions"
  | "tests"
  | "questions"
  | "email"
  | "development";

export type RecruiterNavItem = {
  label: string;
  href: string;
  icon: RecruiterNavIcon;
};

export const recruiterNavigation: RecruiterNavItem[] = [
  { label: "Dashboard", href: "/", icon: "dashboard" },
  { label: "Positions", href: "/positions", icon: "positions" },
  { label: "Email", href: "/email", icon: "email" },
];

export const recruiterUtilityNavigation: RecruiterNavItem[] = [
  { label: "Development", href: "/dev", icon: "development" },
];
