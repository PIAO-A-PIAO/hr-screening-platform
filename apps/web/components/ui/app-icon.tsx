import type { RecruiterNavIcon } from "../../lib/recruiter-navigation";

type AppIconProps = {
  name: RecruiterNavIcon | "arrow" | "plus" | "briefcase" | "people" | "review" | "published" | "menu" | "close" | "logout" | "delete" | "drag" | "moveUp" | "moveDown";
  size?: number;
};

const paths: Record<AppIconProps["name"], React.ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  positions: <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M9 6V4h6v2M3 11h18M10 11v2h4v-2" /></>,
  tests: <><path d="M7 3h10v4H7zM5 5H4a1 1 0 0 0-1 1v14h18V6a1 1 0 0 0-1-1h-1" /><path d="m8 13 2 2 5-5" /></>,
  questions: <><circle cx="12" cy="12" r="9" /><path d="M9.7 9a2.5 2.5 0 1 1 3.2 2.4c-.9.35-.9 1.1-.9 1.6M12 17h.01" /></>,
  email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
  development: <><path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14" /></>,
  arrow: <><path d="M5 12h14M14 7l5 5-5 5" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  briefcase: <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M9 6V4h6v2M3 11h18" /></>,
  people: <><path d="M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy="7" r="4" /><path d="M17 11a4 4 0 0 1 4 4v1" /></>,
  review: <><path d="M7 3h10v4H7zM5 5H4a1 1 0 0 0-1 1v14h18V6a1 1 0 0 0-1-1h-1" /><path d="M8 12h8M8 16h5" /></>,
  published: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5" /></>,
  delete: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" /></>,
  drag: <><circle cx="9" cy="5" r="1" /><circle cx="15" cy="5" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="19" r="1" /><circle cx="15" cy="19" r="1" /></>,
  moveUp: <><path d="m6 14 6-6 6 6" /></>,
  moveDown: <><path d="m6 10 6 6 6-6" /></>,
};

export function AppIcon({ name, size = 20 }: AppIconProps) {
  return (
    <svg className="appIcon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
