import { useState } from "react";
import { useGetBillInstances, useUpdateBillInstance } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import { BillerIcon } from "@/components/biller-icon";
import { format, parseISO } from "date-fns";
import { CheckCircle2, Check, History, Hash, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetBillInstancesQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";

type ConfirmDialog = { billId: number; confirmationNumber: string };

export default function Bills() {
  const [filter, setFilter] = useState<string>("all");
  const [view, setView] = useState<"bills" | "history">("bills");
  const [justPaidIds, setJustPaidIds] = useState<Set<number>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const { data: bills, isLoading } = useGetBillInstances();
  const queryClient = useQueryClient();

  const updateMutation = useUpdateBillInstance({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBillInstancesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      }
    }
  });

  const handleMarkPaidClick = (id: number) => {
    setConfirmDialog({ billId: id, confirmationNumber: "" });
  };

  const handleConfirmPaid = (skip = false) => {
    if (!confirmDialog) return;
    const { billId, confirmationNumber } = confirmDialog;
    setJustPaidIds(prev => new Set(prev).add(billId));
    updateMutation.mutate({
      billId,
      data: {
        status: "paid",
        paidAt: new Date().toISOString(),
        ...((!skip && confirmationNumber) ? { confirmationNumber } : {}),
      }
    });
    setConfirmDialog(null);
    setTimeout(() => {
      setJustPaidIds(prev => { const s = new Set(prev); s.delete(billId); return s; });
    }, 1600);
  };

  const filteredBills = bills?.filter(b => {
    if (view === "history") return b.status === "paid";
    return filter === "all" || b.status === filter;
  }) || [];

  const paidBills = [...filteredBills]
    .filter(b => b.status === "paid")
    .sort((a, b) => {
      const at = a.paidAt ? new Date(a.paidAt).getTime() : 0;
      const bt = b.paidAt ? new Date(b.paidAt).getTime() : 0;
      return bt - at;
    });

  const FILTERS = ["all", "unpaid", "scheduled", "paid", "overdue"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-gradient mb-2">
            {view === "history" ? "Payment History" : "All Bills"}
          </h1>
          <p className="text-muted-foreground">
            {view === "history"
              ? "A complete audit log of all paid bills."
              : "Manage and track all your scheduled payments."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-card border border-white/10 rounded-xl p-1">
            <button
              onClick={() => setView("bills")}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                view === "bills" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-white hover:bg-white/5"
              }`}
            >
              Bills
            </button>
            <button
              onClick={() => setView("history")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                view === "history" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-white hover:bg-white/5"
              }`}
            >
              <History className="w-3.5 h-3.5" /> History
            </button>
          </div>
        </div>
      </div>

      {view === "bills" && (
        <div className="flex items-center gap-2 bg-card border border-white/10 rounded-xl p-1 w-fit">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filter === f
                  ? "bg-primary/80 text-white shadow-md"
                  : "text-muted-foreground hover:text-white hover:bg-white/5"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-white/5 rounded-2xl animate-pulse" />)}
        </div>
      ) : view === "history" ? (
        <HistoryView bills={paidBills} />
      ) : (
        <BillsList
          bills={filteredBills}
          justPaidIds={justPaidIds}
          confirmDialog={confirmDialog}
          onMarkPaid={handleMarkPaidClick}
          onConfirmPaid={handleConfirmPaid}
          onCancelDialog={() => setConfirmDialog(null)}
          onConfirmDialogChange={(val) =>
            setConfirmDialog(prev => prev ? { ...prev, confirmationNumber: val } : null)
          }
          isPending={updateMutation.isPending}
        />
      )}
    </div>
  );
}

function BillsList({
  bills,
  justPaidIds,
  confirmDialog,
  onMarkPaid,
  onConfirmPaid,
  onCancelDialog,
  onConfirmDialogChange,
  isPending,
}: {
  bills: any[];
  justPaidIds: Set<number>;
  confirmDialog: ConfirmDialog | null;
  onMarkPaid: (id: number) => void;
  onConfirmPaid: (skip?: boolean) => void;
  onCancelDialog: () => void;
  onConfirmDialogChange: (val: string) => void;
  isPending: boolean;
}) {
  if (bills.length === 0) {
    return (
      <div className="p-12 text-center glass-panel rounded-2xl">
        <p className="text-lg text-white font-medium">No bills found</p>
        <p className="text-muted-foreground">Try changing your filter criteria.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {bills.map((bill) => {
        const isJustPaid = justPaidIds.has(bill.id);
        const isConfirming = confirmDialog?.billId === bill.id;

        return (
          <div key={bill.id} className="space-y-0">
            <div
              className={`glass-panel p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 group transition-all duration-500 ${
                isJustPaid ? "border-emerald-500/40 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.1)]" : ""
              } ${isConfirming ? "rounded-b-none border-b-0" : ""}`}
            >
              <div className="flex items-center gap-4">
                <BillerIcon icon={bill.biller?.icon} category={bill.biller?.category} name={bill.biller?.name ?? ""} size="lg" />
                <div>
                  <h3 className="font-bold text-lg text-white group-hover:text-primary transition-colors">
                    {bill.biller?.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {bill.biller?.category} • Due {format(parseISO(bill.dueDate), 'MMMM d, yyyy')}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-1/3">
                <div className="text-left sm:text-right">
                  <p className="font-display font-bold text-2xl text-white">{formatCurrency(bill.amountDue)}</p>
                  <StatusBadge status={isJustPaid ? "paid" : bill.status} className="mt-1 inline-block" />
                </div>

                {bill.status !== 'paid' && !isConfirming && (
                  <button
                    onClick={() => !isJustPaid && onMarkPaid(bill.id)}
                    disabled={isPending && !isJustPaid}
                    className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isJustPaid
                        ? "bg-emerald-500 text-white scale-110 shadow-[0_0_20px_rgba(16,185,129,0.5)]"
                        : "bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 hover:scale-105 active:scale-95"
                    }`}
                    title="Mark as Paid"
                  >
                    {isJustPaid ? (
                      <Check className="w-6 h-6 animate-in zoom-in duration-200" strokeWidth={3} />
                    ) : (
                      <CheckCircle2 className="w-6 h-6" />
                    )}
                  </button>
                )}

                {bill.status === 'paid' && (
                  <div className="shrink-0 w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <Check className="w-6 h-6" strokeWidth={2.5} />
                  </div>
                )}
              </div>
            </div>

            {isConfirming && (
              <div className="glass-panel rounded-t-none rounded-b-2xl border-t border-white/5 px-5 py-4 bg-emerald-500/5 border-emerald-500/20 animate-in slide-in-from-top-2 duration-200">
                <p className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Hash className="w-4 h-4 text-emerald-400" />
                  Add Confirmation Number <span className="text-muted-foreground font-normal">(optional)</span>
                </p>
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    type="text"
                    placeholder="e.g. TXN-8472930"
                    value={confirmDialog?.confirmationNumber || ""}
                    onChange={e => onConfirmDialogChange(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") onConfirmPaid(); if (e.key === "Escape") onCancelDialog(); }}
                    className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30 focus:border-emerald-500/50 outline-none transition-colors"
                  />
                  <button
                    onClick={() => onConfirmPaid(true)}
                    className="px-3 py-2 text-sm text-muted-foreground hover:text-white hover:bg-white/5 rounded-lg transition-all"
                  >
                    Skip
                  </button>
                  <button
                    onClick={() => onConfirmPaid()}
                    className="px-4 py-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg transition-all shadow-lg shadow-emerald-500/25"
                  >
                    Mark Paid
                  </button>
                  <button onClick={onCancelDialog} className="p-2 text-muted-foreground hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HistoryView({ bills }: { bills: any[] }) {
  if (bills.length === 0) {
    return (
      <div className="p-12 text-center glass-panel rounded-2xl">
        <History className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-lg text-white font-medium">No payment history yet</p>
        <p className="text-muted-foreground text-sm">Bills you mark as paid will appear here.</p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10 text-left">
            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Biller</th>
            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Due Date</th>
            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Paid On</th>
            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Amount</th>
            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Confirmation #</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {bills.map(bill => (
            <tr key={bill.id} className="hover:bg-white/3 transition-colors group">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <BillerIcon icon={bill.biller?.icon} category={bill.biller?.category} name={bill.biller?.name ?? ""} size="sm" />
                  <div>
                    <p className="font-semibold text-white text-sm">{bill.biller?.name}</p>
                    <p className="text-xs text-muted-foreground">{bill.biller?.category}</p>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-sm text-muted-foreground hidden sm:table-cell">
                {format(parseISO(bill.dueDate), 'MMM d, yyyy')}
              </td>
              <td className="px-6 py-4 text-sm text-emerald-400">
                {bill.paidAt
                  ? format(new Date(bill.paidAt), 'MMM d, yyyy')
                  : <span className="text-muted-foreground">—</span>}
              </td>
              <td className="px-6 py-4 text-right">
                <span className="font-display font-bold text-white">{formatCurrency(bill.amountDue)}</span>
              </td>
              <td className="px-6 py-4 hidden md:table-cell">
                {bill.confirmationNumber ? (
                  <span className="font-mono text-xs bg-white/5 border border-white/10 px-2 py-1 rounded text-white/80">
                    {bill.confirmationNumber}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-sm">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-6 py-3 border-t border-white/10 flex justify-between items-center">
        <p className="text-xs text-muted-foreground">{bills.length} payment{bills.length !== 1 ? "s" : ""} recorded</p>
        <p className="text-sm font-semibold text-white">
          Total: {formatCurrency(bills.reduce((sum, b) => sum + parseFloat(b.amountDue || "0"), 0))}
        </p>
      </div>
    </div>
  );
}
