import Link from "next/link";
import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, eyebrow, description, backHref, backLabel = "Back", actions }: PageHeaderProps) {
  return (
    <header className="dsPageHeader">
      <div className="dsPageHeaderContent">
        {backHref && <Link className="dsPageHeaderBack" href={backHref}>← {backLabel}</Link>}
        {eyebrow && <span className="dsPageHeaderEyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p className="dsPageHeaderDescription">{description}</p>}
      </div>
      {actions && <div className="dsPageHeaderActions">{actions}</div>}
    </header>
  );
}
