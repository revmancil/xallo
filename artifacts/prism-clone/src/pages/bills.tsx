import { useState } from "react";
import { useGetBillInstances, useUpdateBillInstance } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import { BillerIcon } from "@/components/biller-icon";
import { format, parseISO } from "date-fns";
import { CheckCircle2, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetBillInstancesQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";

export default function Bills() {
  const [filter, setFilter] = useState<string>("all");
  const [justPaidIds, setJustPaidIds] = useState<Set<number>>(new Set());
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

  const handleMarkPaid = (id: number) => {
    setJustPaidIds(prev => new Set(prev).add(id));
    updateMutation.mutate({
      billId: id,
      data: { status: "paid", paidAt: new Date().toISOString() }
    });
    setTimeout(() => {
      setJustPaidIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }, 1600);
  };

  const filteredBills = bills?.filter(b => filter === "all" || b.status === filter) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-gradient mb-2">All Bills</h1>
          <p className="text-muted-foreground">Manage and track all your scheduled payments.</p>
        </div>

        <div className="flex items-center gap-2 bg-card border border-white/10 rounded-xl p-1">
          {["all", "unpaid", "scheduled", "paid", "overdue"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filter === f
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-white hover:bg-white/5"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredBills.length === 0 ? (
            <div className="p-12 text-center glass-panel rounded-2xl">
              <p className="text-lg text-white font-medium">No bills found</p>
              <p className="text-muted-foreground">Try changing your filter criteria.</p>
            </div>
          ) : (
            filteredBills.map((bill) => {
              const isJustPaid = justPaidIds.has(bill.id);
              return (
                <div
                  key={bill.id}
                  className={`glass-panel p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 group transition-all duration-500 ${
                    isJustPaid ? "border-emerald-500/40 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.1)]" : ""
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <BillerIcon
                      icon={bill.biller?.icon}
                      category={bill.biller?.category}
                      name={bill.biller?.name ?? ""}
                      size="lg"
                    />
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

                    {bill.status !== 'paid' && (
                      <button
                        onClick={() => !isJustPaid && handleMarkPaid(bill.id)}
                        disabled={updateMutation.isPending && !isJustPaid}
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
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
