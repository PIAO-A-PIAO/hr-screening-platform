"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { recruiterNavigation, recruiterUtilityNavigation, type RecruiterNavItem } from "../../lib/recruiter-navigation";
import { AppIcon } from "../ui/app-icon";

function NavList({ items }: { items: RecruiterNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="recruiterNavList" aria-label="Recruiter navigation">
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link className={active ? "active" : undefined} href={item.href} key={item.href} aria-current={active ? "page" : undefined}>
            <AppIcon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function RecruiterNav() {
  return (
    <>
      <NavList items={recruiterNavigation} />
      <div className="recruiterUtilityNav"><NavList items={recruiterUtilityNavigation} /></div>
    </>
  );
}
