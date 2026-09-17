"use client";

import { Button, ButtonLink } from "./button";

type PaginationProps = {
  page: number;
  totalPages: number;
  onPageChange?: (page: number) => void;
  createHref?: (page: number) => string;
  label?: string;
};

export function Pagination({ page, totalPages, onPageChange, createHref, label = "Pagination" }: PaginationProps) {
  const safeTotal = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotal);

  function action(targetPage: number, text: string, disabled: boolean) {
    if (createHref && !disabled) {
      return <ButtonLink href={createHref(targetPage)} variant="secondary" size="small">{text}</ButtonLink>;
    }
    return <Button variant="secondary" size="small" disabled={disabled} onClick={() => onPageChange?.(targetPage)}>{text}</Button>;
  }

  return (
    <nav className="dsPagination" aria-label={label}>
      <span className="dsPaginationSummary">Page {safePage} of {safeTotal}</span>
      <div className="dsPaginationActions">
        {action(safePage - 1, "Previous", safePage <= 1)}
        {action(safePage + 1, "Next", safePage >= safeTotal)}
      </div>
    </nav>
  );
}
