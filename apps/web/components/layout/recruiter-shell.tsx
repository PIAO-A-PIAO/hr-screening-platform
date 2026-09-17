"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppIcon } from "../ui/app-icon";
import { RecruiterNav } from "./recruiter-nav";

type RecruiterShellProps = {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
};

export function RecruiterShell({ title, eyebrow = "Recruiting", children }: RecruiterShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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
          <span className="recruiterUserAvatar" aria-hidden="true">TR</span>
          <span className="recruiterUserMeta"><strong>Temporary reviewer</strong><small>Recruiter access</small></span>
        </div>

        <RecruiterNav onNavigate={() => setMenuOpen(false)} />

        <button className="recruiterLogout" type="button" disabled title="Authentication will be added in a later milestone">
          <AppIcon name="logout" />
          <span>Logout</span>
          <small>Coming soon</small>
        </button>
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
            <span className="recruiterTopbarAvatar" aria-hidden="true">TR</span>
          </div>
        </header>
        <div className="recruiterMain">{children}</div>
      </div>
    </div>
  );
}
