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
  { label: "Interview tests", href: "/tests", icon: "tests" },
  { label: "Question bank", href: "/questions", icon: "questions" },
  { label: "Email templates", href: "/email-templates", icon: "email" },
];

export const recruiterUtilityNavigation: RecruiterNavItem[] = [
  { label: "Development", href: "/dev", icon: "development" },
];
