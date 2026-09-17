import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  interactive?: boolean;
  selected?: boolean;
  tone?: "default" | "warning" | "danger";
};

export function Card({ children, interactive = false, selected = false, tone = "default", className, ...props }: CardProps) {
  const classes = [
    "dsCard",
    interactive && "dsCard-interactive",
    selected && "dsCard-selected",
    tone !== "default" && `dsCard-${tone}`,
    className,
  ].filter(Boolean).join(" ");

  return <section {...props} className={classes}>{children}</section>;
}

export function CardHeader({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <header {...props} className={["dsCardHeader", className].filter(Boolean).join(" ")}>{children}</header>;
}

export function CardContent({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={["dsCardContent", className].filter(Boolean).join(" ")}>{children}</div>;
}

export function CardFooter({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <footer {...props} className={["dsCardFooter", className].filter(Boolean).join(" ")}>{children}</footer>;
}
