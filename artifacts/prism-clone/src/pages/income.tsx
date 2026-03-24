import { useState } from "react";
import { useGetIncomeEntries, useCreateIncomeEntry, useDeleteIncomeEntry } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Plus, Trash2, Banknote } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { getGetIncomeEntriesQueryKey } from "@workspace/api-client-react";

export default function Income() {
  const { data: incomes, isLoading } = useGetIncomeEntries();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);

  const createMutation = useCreateIncomeEntry({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetIncomeEntriesQueryKey() });
        setIsAdding(false);
      }
    }
  });

  const deleteMutation = useDeleteIncomeEntry({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetIncomeEntriesQueryKey() })
    }
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      data: {
        label: fd.get("label") as string,
        amount: Number(fd.get("amount")),
        payDate: fd.get("payDate") as string,
        recurrence: fd.get("recurrence") as "biweekly",
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-gradient mb-2">Income Tracking</h1>
          <p className="text-muted-foreground">Log your paydays to visualize cash flow.</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold shadow-lg shadow-emerald-500/25 flex items-center gap-2 transition-all whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Add Payday</span>
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleCreate} className="glass-panel p-6 rounded-2xl border border-emerald-500/20 space-y-4 animate-in fade-in slide-in-from-top-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-white/80">Label (e.g. Salary)</label>
              <input name="label" required className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-emerald-500 outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-white/80">Amount</label>
              <input name="amount" type="number" step="0.01" required className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-emerald-500 outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-white/80">Next Pay Date</label>
              <input name="payDate" type="date" required className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-emerald-500 outline-none [color-scheme:dark]" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-white/80">Recurrence</label>
              <select name="recurrence" className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-emerald-500 outline-none">
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-white/70 hover:bg-white/5 rounded-lg">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600">Save</button>
          </div>
        </form>
      )}

      <div className="glass-panel rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />)}
          </div>
        ) : incomes?.length === 0 ? (
          <div className="p-10 text-center text-white/50">No income entries yet.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {incomes?.map(inc => (
              <div key={inc.id} className="p-4 flex items-center gap-3 group hover:bg-white/[0.02] transition-colors">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                  <Banknote className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white">{inc.label}</span>
                    <span className="text-xs px-2 py-0.5 bg-white/10 rounded-full text-white/60 capitalize">{inc.recurrence}</span>
                  </div>
                  <p className="text-sm text-white/50 mt-0.5">
                    {format(parseISO(inc.payDate), 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-emerald-400 whitespace-nowrap">{formatCurrency(inc.amount)}</span>
                  <button 
                    onClick={() => deleteMutation.mutate({ incomeId: inc.id })}
                    className="p-2 text-white/30 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
