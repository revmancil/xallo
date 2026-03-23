import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "unpaid" | "paid" | "scheduled" | "overdue";
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const styles = {
    unpaid: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.1)]",
    paid: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]",
    scheduled: "bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]",
    overdue: "bg-rose-500/10 text-rose-500 border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.1)] animate-pulse",
  };

  const labels = {
    unpaid: "Unpaid",
    paid: "Paid",
    scheduled: "Scheduled",
    overdue: "Overdue",
  };

  return (
    <span
      className={cn(
        "px-2.5 py-1 rounded-full text-xs font-semibold border backdrop-blur-sm tracking-wide",
        styles[status] || styles.unpaid,
        className
      )}
    >
      {labels[status] || status}
    </span>
  );
}
