import Link from "next/link";
import { AppIcon } from "./app-icon";

type ActionLinkProps = {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  arrow?: boolean;
};

export function ActionLink({ href, children, variant = "primary", arrow = false }: ActionLinkProps) {
  return (
    <Link className={`dsAction dsAction-${variant}`} href={href}>
      {!arrow && <AppIcon name="plus" size={18} />}
      {children}
      {arrow && <AppIcon name="arrow" size={17} />}
    </Link>
  );
}
