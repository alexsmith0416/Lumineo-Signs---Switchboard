import type { ReactNode } from "react";

type Variant =
  | "Paint"
  | "Assembly"
  | "Install"
  | "Survey"
  | "Complete"
  | "Pending"
  | "Synced"
  | "Local"
  | "Active";

const styles: Record<Variant, string> = {
  Paint: "bg-[#fef3c7] text-[#92400e]",
  Assembly: "bg-[#dbeafe] text-[#1e40af]",
  Install: "bg-[#dcfce7] text-[#166534]",
  Survey: "bg-[#f3e8ff] text-[#6b21a8]",
  Complete: "bg-[#e0e7ff] text-navy",
  Pending: "bg-[#fee2e2] text-[#991b1b]",
  Synced: "bg-[#d1fae5] text-[#065f46]",
  Local: "bg-[#fef3c7] text-[#92400e]",
  Active: "bg-[#f3e8ff] text-[#6b21a8]",
};

interface Props {
  variant: Variant;
  children: ReactNode;
  className?: string;
}

export function StatusPill({ variant, children, className = "" }: Props) {
  return (
    <span
      className={`inline-flex text-[10px] font-bold px-2 py-[3px] rounded-full uppercase tracking-wider ${styles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
