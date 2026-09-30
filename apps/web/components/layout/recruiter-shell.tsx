"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppIcon } from "../ui/app-icon";
import { RecruiterNav } from "./recruiter-nav";
import type { InternalUser } from "../../lib/internal-auth";

type RecruiterShellProps = {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  user: InternalUser;
};

export function RecruiterShell({ title, eyebrow = "Recruiting", children, user }: RecruiterShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const initials = user.name.split(/\s+/).map(part => part[0] ?? '').slice(0, 2).join('').toUpperCase();
  async function logout() {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Sign out failed');
      window.location.assign('/login');
    } catch { setLogoutError(true); }
  }

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  return (
    <div className="recruiterApp">
      <button
        className={`recruiterSidebarBackdrop${menuOpen ? " recruiterSidebarBackdropOpen" : ""}`}
        type="button"
        aria-label="Close navigation"
        tabIndex={menuOpen ? 0 : -1}
        onClick={() => setMenuOpen(false)}
      />
      <aside className={`recruiterSidebar${menuOpen ? " recruiterSidebarOpen" : ""}`} id="recruiter-navigation" aria-label="Recruiter workspace">
        <div className="recruiterSidebarHeader">
          <Link className="recruiterBrand" href="/" aria-label="DS-HR dashboard" onClick={() => setMenuOpen(false)}>
            <span className="recruiterBrandMark" aria-hidden="true">DS</span>
            <span><strong>DS-HR</strong><small>Digital Shovel</small></span>
          </Link>
          <button ref={closeButtonRef} className="recruiterSidebarClose" type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)}>
            <AppIcon name="close" />
          </button>
        </div>

        <div className="recruiterUser" aria-label="Current user">
          <span className="recruiterUserAvatar" aria-hidden="true">{initials}</span>
          <span className="recruiterUserMeta"><strong>{user.name}</strong><small>{user.role === 'ADMIN' ? 'Admin' : 'Recruiter'}</small></span>
        </div>

        <RecruiterNav user={user} onNavigate={() => setMenuOpen(false)} />

        <button className="recruiterLogout" type="button" onClick={() => void logout()}>
          <AppIcon name="logout" />
          <span>Logout</span>
        </button>
        {logoutError && <p role="alert">Could not sign out. Please try again.</p>}
      </aside>
      <div className="recruiterWorkspace">
        <header className="recruiterTopbar">
          <div className="recruiterTopbarContext">
            <button
              className="recruiterMobileMenu"
              type="button"
              aria-label="Open navigation"
              aria-controls="recruiter-navigation"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <AppIcon name="menu" />
            </button>
            <div><span>{eyebrow}</span><strong>{title}</strong></div>
          </div>
          <div className="recruiterTopbarIdentity">
            <div className="recruiterEnvironment">Internal workspace</div>
            <span className="recruiterTopbarAvatar" aria-hidden="true">{initials}</span>
          </div>
        </header>
        <div className="recruiterMain">{children}</div>
      </div>
    </div>
  );
}
