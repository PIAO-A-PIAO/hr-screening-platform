import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "./spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "small" | "medium" | "large";

type SharedButtonProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  loading?: boolean;
  className?: string;
};

function buttonClassName(variant: ButtonVariant, size: ButtonSize, className?: string) {
  const sizeClass = size === "small" ? "dsButton-sm" : size === "large" ? "dsButton-lg" : "";
  return ["dsButton", `dsButton-${variant}`, sizeClass, className].filter(Boolean).join(" ");
}

export type ButtonProps = SharedButtonProps & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  children,
  variant = "primary",
  size = "medium",
  leadingIcon,
  trailingIcon,
  loading = false,
  className,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={buttonClassName(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <Spinner size="small" label="Working" /> : leadingIcon}
      <span>{children}</span>
      {!loading && trailingIcon}
    </button>
  );
}

export type ButtonLinkProps = SharedButtonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string };

export function ButtonLink({
  children,
  href,
  variant = "primary",
  size = "medium",
  leadingIcon,
  trailingIcon,
  loading = false,
  className,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      {...props}
      href={href}
      className={buttonClassName(variant, size, className)}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
    >
      {loading ? <Spinner size="small" label="Loading destination" /> : leadingIcon}
      <span>{children}</span>
      {!loading && trailingIcon}
    </Link>
  );
}
