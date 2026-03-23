import { useState, useEffect, useCallback } from "react";
import { useGetAccounts, useCreateAccount } from "@workspace/api-client-react";
import { formatCurrency, toNumber } from "@/lib/utils";
import { Plus, Landmark, CreditCard, RefreshCw, Link2, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetAccountsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { usePlaidLink } from "react-plaid-link";

const API_BASE = import.meta.env.BASE_URL + "api";

function PlaidLinkSection({ onSuccess }: { onSuccess: () => void }) {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error" | "unconfigured">("idle");
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [linking, setLinking] = useState(false);
  const [linkedMsg, setLinkedMsg] = useState<string>("");

  useEffect(() => {
    fetch(`${API_BASE}/plaid/status`)
      .then(r => r.json())
      .then(data => {
        if (!data.configured) {
          setStatus("unconfigured");
        } else {
          setStatus("idle");
        }
      })
      .catch(() => setStatus("error"));
  }, []);

  const fetchLinkToken = async () => {
    setStatus("loading");
    try {
      const res = await fetch(`${API_BASE}/plaid/create-link-token`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to get link token");
      setLinkToken(data.link_token);
      setStatus("ready");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to connect to Plaid.");
      setStatus("error");
    }
  };

  const handlePlaidSuccess = useCallback(async (publicToken: string, metadata: any) => {
    setLinking(true);
    try {
      const res = await fetch(`${API_BASE}/plaid/exchange-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token: publicToken, metadata }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLinkedMsg(`Successfully linked ${metadata?.institution?.name || "your bank"} — ${data.accountsImported} account(s) imported.`);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to link account.");
      setStatus("error");
    } finally {
      setLinking(false);
      setLinkToken(null);
      setStatus("idle");
    }
  }, [onSuccess]);

  const { open: openPlaid, ready: plaidReady } = usePlaidLink({
    token: linkToken || "",
    onSuccess: handlePlaidSuccess,
    onExit: () => { setLinkToken(null); setStatus("idle"); },
  });

  useEffect(() => {
    if (status === "ready" && plaidReady && linkToken) {
      openPlaid();
    }
  }, [status, plaidReady, linkToken, openPlaid]);

  return (
    <div className="glass-panel rounded-2xl border border-blue-500/10 overflow-hidden">
      <div className="flex items-center gap-4 p-4">
        <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
          <Link2 className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm">Connect with Plaid</p>
          <p className="text-xs text-muted-foreground leading-snug">
            Sync real bank balances, credit card due dates &amp; discover recurring bills automatically.
          </p>
        </div>
        {status === "unconfigured" ? (
          <span className="shrink-0 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg">
            Setup Required
          </span>
        ) : (
          <button
            onClick={fetchLinkToken}
            disabled={status === "loading" || status === "ready" || linking}
            className="shrink-0 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm shadow-lg shadow-blue-500/20 transition-all"
          >
            {(status === "loading" || linking) ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Connecting…</>
            ) : (
              <><Link2 className="w-4 h-4" /> Link Account</>
            )}
          </button>
        )}
      </div>

      {linkedMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-500/10 border-t border-emerald-500/20 text-sm text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {linkedMsg}
        </div>
      )}

      {status === "error" && errorMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-rose-500/10 border-t border-rose-500/20 text-sm text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      {status === "unconfigured" && (
        <div className="px-4 py-3 bg-amber-500/5 border-t border-amber-500/15 text-xs text-amber-200/60">
          Set <code className="bg-black/20 px-1 rounded">PLAID_CLIENT_ID</code> &amp;{" "}
          <code className="bg-black/20 px-1 rounded">PLAID_SECRET</code> env vars.{" "}
          Free sandbox at{" "}
          <a href="https://dashboard.plaid.com/signup" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-200">
            dashboard.plaid.com
          </a>.
        </div>
      )}
    </div>
  );
}

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

  const refreshAccounts = () => {
    queryClient.invalidateQueries({ queryKey: getGetAccountsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const totalBalance = accounts?.reduce((sum, acc) => sum + toNumber(acc.balance), 0) || 0;

  return (
    <div className="space-y-6 pb-8">
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
          [1, 2].map(i => <div key={i} className="h-32 bg-white/5 rounded-2xl animate-pulse" />)
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
              <button onClick={refreshAccounts} className="text-white/30 hover:text-white transition-colors" title="Refresh balance">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-auto">
              <p className="text-3xl font-bold text-white">{formatCurrency(acc.balance)}</p>
            </div>
          </div>
        ))}
      </div>

      <PlaidLinkSection onSuccess={refreshAccounts} />
    </div>
  );
}
