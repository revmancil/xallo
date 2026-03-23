import { useState } from "react";
import { useGetAccounts, useCreateAccount } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Plus, Landmark, CreditCard, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetAccountsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";

export default function Accounts() {
  const { data: accounts, isLoading } = useGetAccounts();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);

  const createMutation = useCreateAccount({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAccountsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        setIsAdding(false);
      }
    }
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      data: {
        name: fd.get("name") as string,
        balance: Number(fd.get("balance")),
        institution: fd.get("institution") as string,
      }
    });
  };

  const totalBalance = accounts?.reduce((sum, acc) => sum + acc.balance, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-gradient mb-2">Bank Accounts</h1>
          <p className="text-muted-foreground">Manage balances to calculate your Safety Gap.</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold shadow-lg shadow-primary/25 flex items-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" /> Add Account
        </button>
      </div>

      <div className="glass-panel p-8 rounded-2xl border-l-4 border-l-primary flex items-center justify-between bg-gradient-to-r from-primary/10 to-transparent">
        <div>
          <p className="text-primary font-semibold mb-1">Total Available Cash</p>
          <h2 className="text-4xl font-display font-bold text-white">{formatCurrency(totalBalance)}</h2>
        </div>
        <Landmark className="w-16 h-16 text-primary/30" />
      </div>

      {isAdding && (
        <form onSubmit={handleCreate} className="glass-panel p-6 rounded-2xl border border-primary/20 space-y-4 animate-in fade-in slide-in-from-top-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-white/80">Account Name</label>
              <input name="name" required className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-primary outline-none" placeholder="e.g. Main Checking" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-white/80">Institution</label>
              <input name="institution" className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-primary outline-none" placeholder="e.g. Chase" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-white/80">Current Balance</label>
              <input name="balance" type="number" step="0.01" required className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-primary outline-none" placeholder="0.00" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-white/70 hover:bg-white/5 rounded-lg">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90">Save Account</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          [1,2].map(i => <div key={i} className="h-32 bg-white/5 rounded-2xl animate-pulse" />)
        ) : accounts?.map(acc => (
          <div key={acc.id} className="glass-panel p-6 rounded-2xl flex flex-col justify-between hover:border-white/20 transition-colors">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg leading-tight">{acc.name}</h3>
                  <p className="text-sm text-muted-foreground">{acc.institution || 'Manual Account'}</p>
                </div>
              </div>
              <button className="text-white/30 hover:text-white transition-colors" title="Sync (Mock)">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-auto">
              <p className="text-3xl font-bold text-white">{formatCurrency(acc.balance)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
