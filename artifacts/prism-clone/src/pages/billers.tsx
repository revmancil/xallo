import { useState } from "react";
import { useGetBillers, useCreateBiller, useDeleteBiller } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Plus, Trash2, Globe, Building2, LayoutGrid } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetBillersQueryKey } from "@workspace/api-client-react";

export default function Billers() {
  const { data: billers, isLoading } = useGetBillers();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);

  const createMutation = useCreateBiller({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBillersQueryKey() });
        setIsAdding(false);
      }
    }
  });

  const deleteMutation = useDeleteBiller({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetBillersQueryKey() })
    }
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      data: {
        name: fd.get("name") as string,
        category: fd.get("category") as string,
        recurrence: fd.get("recurrence") as "monthly",
        typicalAmount: Number(fd.get("typicalAmount")) || undefined,
        websiteUrl: fd.get("websiteUrl") as string,
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-gradient mb-2">Billers</h1>
          <p className="text-muted-foreground">Manage the companies and people you pay.</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold shadow-lg shadow-primary/25 flex items-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" /> Add Biller
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleCreate} className="glass-panel p-6 rounded-2xl border border-primary/20 space-y-4 animate-in fade-in slide-in-from-top-4">
          <h3 className="text-lg font-bold text-white">Add New Biller</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-white/80">Biller Name *</label>
              <input name="name" required className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" placeholder="e.g. Electric Co" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-white/80">Category *</label>
              <input name="category" required className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary" placeholder="e.g. Utilities" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-white/80">Typical Amount</label>
              <input name="typicalAmount" type="number" step="0.01" className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary" placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-white/80">Recurrence *</label>
              <select name="recurrence" className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary">
                <option value="monthly">Monthly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="weekly">Weekly</option>
                <option value="one-time">One-time</option>
              </select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-white/80">Website URL</label>
              <input name="websiteUrl" type="url" className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary" placeholder="https://..." />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 rounded-lg text-white/70 hover:bg-white/5">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50">Save Biller</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
           [1,2,3].map(i => <div key={i} className="h-40 bg-white/5 rounded-2xl animate-pulse" />)
        ) : billers?.map(biller => (
          <div key={biller.id} className="glass-panel p-6 rounded-2xl relative group">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-indigo-400" />
              </div>
              <button 
                onClick={() => deleteMutation.mutate({ billerId: biller.id })}
                className="p-2 text-white/30 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            
            <h3 className="font-bold text-xl text-white mb-1">{biller.name}</h3>
            
            <div className="space-y-2 mt-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-white/50" />
                <span>{biller.category}</span>
              </div>
              {biller.typicalAmount && (
                <div className="flex items-center gap-2 text-white/90">
                  <span className="font-semibold text-emerald-400">{formatCurrency(biller.typicalAmount)}</span>
                  <span className="text-xs px-2 py-0.5 bg-white/10 rounded-full">{biller.recurrence}</span>
                </div>
              )}
              {biller.websiteUrl && (
                <div className="flex items-center gap-2 mt-2">
                  <Globe className="w-4 h-4 text-blue-400" />
                  <a href={biller.websiteUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline truncate">
                    {new URL(biller.websiteUrl).hostname}
                  </a>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
