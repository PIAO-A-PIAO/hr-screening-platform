"use client";

import Link from "next/link";

export type TabItem = {
  id: string;
  label: string;
  count?: number;
  href?: string;
  disabled?: boolean;
};

type TabsProps = {
  label: string;
  items: TabItem[];
  activeId: string;
  onChange?: (id: string) => void;
};

export function Tabs({ label, items, activeId, onChange }: TabsProps) {
  return (
    <div className="dsTabs" role="tablist" aria-label={label}>
      {items.map((item) => {
        const active = item.id === activeId;
        const content = <>{item.label}{typeof item.count === "number" && <span className="dsTabCount">{item.count}</span>}</>;
        const className = ["dsTab", active && "dsTab-active"].filter(Boolean).join(" ");

        if (item.href && !item.disabled) {
          return <Link className={className} href={item.href} key={item.id} role="tab" aria-selected={active}>{content}</Link>;
        }

        return (
          <button
            className={className}
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={item.disabled}
            onClick={() => onChange?.(item.id)}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
