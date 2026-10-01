"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { recruiterNavigation, recruiterUtilityNavigation, type RecruiterNavItem } from "../../lib/recruiter-navigation";
import { AppIcon } from "../ui/app-icon";
import type { InternalUser } from "../../lib/internal-auth";

function NavList({ items, label, onNavigate }: { items: RecruiterNavItem[]; label: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="recruiterNavList" aria-label={label}>
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link className={active ? "active" : undefined} href={item.href} key={item.href} aria-current={active ? "page" : undefined} onClick={onNavigate}>
            <AppIcon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function RecruiterNav({ onNavigate, user }: { onNavigate?: () => void; user: InternalUser }) {
  return (
    <>
      <NavList items={recruiterNavigation} label="Primary navigation" onNavigate={onNavigate} />
      {user.role === 'ADMIN' && <nav className="recruiterNavList" aria-label="Administration"><Link href="/admin" onClick={onNavigate}>Administration</Link></nav>}
      <div className="recruiterUtilityNav"><NavList items={recruiterUtilityNavigation} label="Utility navigation" onNavigate={onNavigate} /></div>
    </>
  );
}
