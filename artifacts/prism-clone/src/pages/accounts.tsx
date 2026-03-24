import { useState, useEffect, useCallback } from "react";
import { useGetAccounts, useCreateAccount } from "@workspace/api-client-react";
import { formatCurrency, toNumber } from "@/lib/utils";
import {
  Plus, Landmark, CreditCard, RefreshCw, Link2, CheckCircle2,
  AlertCircle, Loader2, Pencil, Trash2, X, ChevronDown, ChevronUp,
  TrendingUp, Wallet,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetAccountsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { usePlaidLink } from "react-plaid-link";

const API_BASE = import.meta.env.BASE_URL + "api";

// ─── Types ────────────────────────────────────────────────────────────────────

type CreditCard = {
  id: number;
  userId: string;
  name: string;
  institution: string | null;
  lastFour: string | null;
  creditLimit: string;
  currentBalance: string;
  apr: string | null;
  statementDueDay: number | null;
  minimumPayment: string | null;
  color: string | null;
};

type CardFormData = {
  name: string;
  institution: string;
  lastFour: string;
  creditLimit: string;
  currentBalance: string;
  apr: string;
  statementDueDay: string;
  minimumPayment: string;
  color: string;
};

const BLANK_FORM: CardFormData = {
  name: "", institution: "", lastFour: "", creditLimit: "", currentBalance: "",
  apr: "", statementDueDay: "", minimumPayment: "", color: "#6366f1",
};

const CARD_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316",
  "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#64748b",
];

// ─── Utility ──────────────────────────────────────────────────────────────────

function utilizationColor(pct: number) {
  if (pct < 30) return "bg-emerald-500";
  if (pct < 60) return "bg-amber-500";
  return "bg-rose-500";
}

function utilizationLabel(pct: number) {
  if (pct < 30) return "text-emerald-400";
  if (pct < 60) return "text-amber-400";
  return "text-rose-400";
}

// ─── Credit Card Form ─────────────────────────────────────────────────────────

function CardForm({
  initial, onSave, onCancel, saving,
}: {
  initial: CardFormData;
  onSave: (data: CardFormData) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<CardFormData>(initial);
  const set = (k: keyof CardFormData, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="glass-panel p-5 rounded-2xl border border-primary/20 space-y-4 animate-in fade-in slide-in-from-top-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Card Name *</label>
          <input
            value={form.name} onChange={e => set("name", e.target.value)} required
            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary outline-none"
            placeholder="e.g. Chase Sapphire"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Issuer</label>
          <input
            value={form.institution} onChange={e => set("institution", e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary outline-none"
            placeholder="e.g. Chase"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last 4 Digits</label>
          <input
            value={form.lastFour} onChange={e => set("lastFour", e.target.value.slice(0, 4))}
            maxLength={4} pattern="\d{4}"
            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary outline-none font-mono"
            placeholder="0000"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Credit Limit *</label>
          <input
            type="number" min="0" step="100" value={form.creditLimit}
            onChange={e => set("creditLimit", e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary outline-none"
            placeholder="5000"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current Balance</label>
          <input
            type="number" min="0" step="0.01" value={form.currentBalance}
            onChange={e => set("currentBalance", e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary outline-none"
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">APR (%)</label>
          <input
            type="number" min="0" max="100" step="0.1" value={form.apr}
            onChange={e => set("apr", e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary outline-none"
            placeholder="24.99"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Statement Due Day</label>
          <input
            type="number" min="1" max="28" step="1" value={form.statementDueDay}
            onChange={e => set("statementDueDay", e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary outline-none"
            placeholder="15"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Minimum Payment</label>
          <input
            type="number" min="0" step="0.01" value={form.minimumPayment}
            onChange={e => set("minimumPayment", e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary outline-none"
            placeholder="25.00"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Card Color</label>
          <div className="flex gap-2 flex-wrap pt-1">
            {CARD_COLORS.map(c => (
              <button
                key={c} type="button"
                onClick={() => set("color", c)}
                className="w-6 h-6 rounded-full border-2 transition-all"
                style={{ backgroundColor: c, borderColor: form.color === c ? "white" : "transparent" }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg text-sm transition-all">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => { if (form.name && form.creditLimit) onSave(form); }}
          disabled={saving || !form.name || !form.creditLimit}
          className="px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold text-sm shadow-lg shadow-primary/25 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin inline-block mr-1" /> : null}
          Save Card
        </button>
      </div>
    </div>
  );
}

// ─── Credit Card Visual Card ──────────────────────────────────────────────────

function CreditCardCard({
  card, onEdit, onDelete, expanded, onToggle,
}: {
  card: CreditCard; onEdit: () => void; onDelete: () => void;
  expanded: boolean; onToggle: () => void;
}) {
  const limit = toNumber(card.creditLimit);
  const balance = toNumber(card.currentBalance);
  const available = Math.max(0, limit - balance);
  const utilPct = limit > 0 ? Math.min(100, (balance / limit) * 100) : 0;

  return (
    <div className="glass-panel rounded-2xl overflow-hidden hover:border-white/20 transition-colors">
      {/* Card visual header */}
      <div
        className="relative p-5 pb-4 overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${card.color || "#6366f1"}33 0%, ${card.color || "#6366f1"}11 100%)` }}
      >
        <div
          className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-10 -translate-y-1/2 translate-x-1/4"
          style={{ background: card.color || "#6366f1" }}
        />
        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: card.color || "#6366f1" }}
            >
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white leading-tight">{card.name}</h3>
              <p className="text-xs text-muted-foreground">
                {card.institution || "Credit Card"}
                {card.lastFour && <span className="ml-1.5 font-mono">•••• {card.lastFour}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onEdit} className="p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/10 transition-all">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDelete} className="p-1.5 text-white/40 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-all">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={onToggle} className="p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/10 transition-all">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Balance & limit */}
        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Current Balance</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(balance)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground mb-0.5">Available</p>
            <p className="text-lg font-semibold text-emerald-400">{formatCurrency(available)}</p>
          </div>
        </div>
      </div>

      {/* Utilization bar */}
      <div className="px-5 py-3 border-t border-white/5">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs text-muted-foreground">Credit utilization</p>
          <span className={`text-xs font-bold ${utilizationLabel(utilPct)}`}>{utilPct.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${utilizationColor(utilPct)}`}
            style={{ width: `${utilPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-muted-foreground/60">$0</span>
          <span className="text-xs text-muted-foreground/60">{formatCurrency(limit)} limit</span>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-5 pb-4 border-t border-white/5 pt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {card.apr && (
            <div>
              <p className="text-xs text-muted-foreground">APR</p>
              <p className="text-sm font-semibold text-white">{toNumber(card.apr).toFixed(2)}%</p>
            </div>
          )}
          {card.statementDueDay && (
            <div>
              <p className="text-xs text-muted-foreground">Due Day</p>
              <p className="text-sm font-semibold text-white">
                {card.statementDueDay}{["st","nd","rd"][card.statementDueDay - 1] || "th"} of month
              </p>
            </div>
          )}
          {card.minimumPayment && (
            <div>
              <p className="text-xs text-muted-foreground">Min. Payment</p>
              <p className="text-sm font-semibold text-white">{formatCurrency(card.minimumPayment)}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">Credit Limit</p>
            <p className="text-sm font-semibold text-white">{formatCurrency(limit)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Plaid Link ───────────────────────────────────────────────────────────────

function PlaidLinkSection({ onSuccess }: { onSuccess: () => void }) {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error" | "unconfigured">("idle");
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [linking, setLinking] = useState(false);
  const [linkedMsg, setLinkedMsg] = useState<string>("");

  useEffect(() => {
    fetch(`${API_BASE}/plaid/status`)
      .then(r => r.json())
      .then(data => { setStatus(data.configured ? "idle" : "unconfigured"); })
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
    if (status === "ready" && plaidReady && linkToken) openPlaid();
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
            className="shrink-0 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-semibold text-sm shadow-lg shadow-blue-500/20 transition-all"
          >
            {(status === "loading" || linking) ? <><Loader2 className="w-4 h-4 animate-spin" /> Connecting…</> : <><Link2 className="w-4 h-4" /> Link Account</>}
          </button>
        )}
      </div>
      {linkedMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-500/10 border-t border-emerald-500/20 text-sm text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" />{linkedMsg}
        </div>
      )}
      {status === "error" && errorMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-rose-500/10 border-t border-rose-500/20 text-sm text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0" />{errorMsg}
        </div>
      )}
      {status === "unconfigured" && (
        <div className="px-4 py-3 bg-amber-500/5 border-t border-amber-500/15 text-xs text-amber-200/60">
          Set <code className="bg-black/20 px-1 rounded">PLAID_CLIENT_ID</code> &amp;{" "}
          <code className="bg-black/20 px-1 rounded">PLAID_SECRET</code> env vars. Free sandbox at{" "}
          <a href="https://dashboard.plaid.com/signup" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-200">
            dashboard.plaid.com
          </a>.
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Accounts() {
  const { data: accounts, isLoading: loadingAccounts } = useGetAccounts();
  const queryClient = useQueryClient();
  const [isAddingAccount, setIsAddingAccount] = useState(false);

  // Credit cards state
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [savingCard, setSavingCard] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({});

  const createAccountMutation = useCreateAccount({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAccountsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        setIsAddingAccount(false);
      }
    }
  });

  // ─── Credit card API calls ───────────────────────────────────────────────────

  const loadCards = async () => {
    try {
      const res = await fetch(`${API_BASE}/credit-cards`);
      const data = await res.json();
      if (Array.isArray(data)) setCards(data);
    } catch {} finally { setLoadingCards(false); }
  };

  useEffect(() => { loadCards(); }, []);

  const handleSaveCard = async (form: CardFormData) => {
    setSavingCard(true);
    const body = {
      name: form.name,
      institution: form.institution || null,
      lastFour: form.lastFour || null,
      creditLimit: parseFloat(form.creditLimit) || 0,
      currentBalance: parseFloat(form.currentBalance) || 0,
      apr: form.apr ? parseFloat(form.apr) : null,
      statementDueDay: form.statementDueDay ? parseInt(form.statementDueDay) : null,
      minimumPayment: form.minimumPayment ? parseFloat(form.minimumPayment) : null,
      color: form.color || "#6366f1",
    };
    try {
      if (editingCard) {
        const res = await fetch(`${API_BASE}/credit-cards/${editingCard.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        const updated = await res.json();
        setCards(prev => prev.map(c => c.id === editingCard.id ? updated : c));
        setEditingCard(null);
      } else {
        const res = await fetch(`${API_BASE}/credit-cards`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        const created = await res.json();
        setCards(prev => [...prev, created]);
        setIsAddingCard(false);
      }
    } catch {} finally { setSavingCard(false); }
  };

  const handleDeleteCard = async (id: number) => {
    await fetch(`${API_BASE}/credit-cards/${id}`, { method: "DELETE" });
    setCards(prev => prev.filter(c => c.id !== id));
  };

  const handleCreateAccount = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createAccountMutation.mutate({
      data: { name: fd.get("name") as string, balance: Number(fd.get("balance")), institution: fd.get("institution") as string }
    });
  };

  const refreshAccounts = () => {
    queryClient.invalidateQueries({ queryKey: getGetAccountsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  // ─── Computed totals ─────────────────────────────────────────────────────────

  const totalCash = accounts?.reduce((s, a) => s + toNumber(a.balance), 0) || 0;
  const totalCreditLimit = cards.reduce((s, c) => s + toNumber(c.creditLimit), 0);
  const totalCreditBalance = cards.reduce((s, c) => s + toNumber(c.currentBalance), 0);
  const totalAvailableCredit = Math.max(0, totalCreditLimit - totalCreditBalance);
  const overallUtilization = totalCreditLimit > 0 ? (totalCreditBalance / totalCreditLimit) * 100 : 0;

  return (
    <div className="space-y-8 pb-10">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-gradient mb-2">Accounts</h1>
        <p className="text-muted-foreground">Track your cash accounts and credit cards in one place.</p>
      </div>

      {/* ─── Summary row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-2xl border-l-4 border-l-primary">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 text-primary" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Cash</p>
          </div>
          <p className="text-2xl font-bold text-white">{formatCurrency(totalCash)}</p>
        </div>
        <div className="glass-panel p-5 rounded-2xl border-l-4 border-l-emerald-500">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-4 h-4 text-emerald-400" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Available Credit</p>
          </div>
          <p className="text-2xl font-bold text-white">{formatCurrency(totalAvailableCredit)}</p>
        </div>
        <div className="glass-panel p-5 rounded-2xl border-l-4 border-l-rose-500">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-rose-400" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Credit Debt</p>
          </div>
          <p className="text-2xl font-bold text-white">{formatCurrency(totalCreditBalance)}</p>
          {totalCreditLimit > 0 && (
            <p className={`text-xs mt-1 font-semibold ${utilizationLabel(overallUtilization)}`}>
              {overallUtilization.toFixed(0)}% overall utilization
            </p>
          )}
        </div>
      </div>

      {/* ─── Bank Accounts section ────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
              <Landmark className="w-5 h-5 text-primary" /> Bank Accounts
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">Manage balances to calculate your Safety Gap.</p>
          </div>
          <button
            onClick={() => setIsAddingAccount(!isAddingAccount)}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold text-sm shadow-lg shadow-primary/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Account</span>
          </button>
        </div>

        {isAddingAccount && (
          <form onSubmit={handleCreateAccount} className="glass-panel p-5 rounded-2xl border border-primary/20 space-y-4 animate-in fade-in slide-in-from-top-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account Name</label>
                <input name="name" required className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary outline-none" placeholder="e.g. Main Checking" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Institution</label>
                <input name="institution" className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary outline-none" placeholder="e.g. Chase" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current Balance</label>
                <input name="balance" type="number" step="0.01" required className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary outline-none" placeholder="0.00" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsAddingAccount(false)} className="px-4 py-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg text-sm">Cancel</button>
              <button type="submit" disabled={createAccountMutation.isPending} className="px-5 py-2 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 disabled:opacity-50">Save Account</button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loadingAccounts ? (
            [1, 2].map(i => <div key={i} className="h-32 bg-white/5 rounded-2xl animate-pulse" />)
          ) : accounts?.length === 0 ? (
            <div className="col-span-2 p-8 text-center glass-panel rounded-2xl border border-white/10">
              <Landmark className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-muted-foreground">No bank accounts yet — add one above or link via Plaid.</p>
            </div>
          ) : accounts?.map(acc => (
            <div key={acc.id} className="glass-panel p-5 rounded-2xl flex flex-col justify-between hover:border-white/20 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Landmark className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white leading-tight">{acc.name}</h3>
                    <p className="text-xs text-muted-foreground">{acc.institution || "Manual Account"}</p>
                  </div>
                </div>
                <button onClick={refreshAccounts} className="text-white/30 hover:text-white transition-colors p-1">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-3xl font-bold text-white">{formatCurrency(acc.balance)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Credit Cards section ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-violet-400" /> Credit Cards
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">Track limits, balances, and utilization.</p>
          </div>
          <button
            onClick={() => { setIsAddingCard(!isAddingCard); setEditingCard(null); }}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-violet-500/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Card</span>
          </button>
        </div>

        {isAddingCard && !editingCard && (
          <CardForm
            initial={BLANK_FORM}
            onSave={handleSaveCard}
            onCancel={() => setIsAddingCard(false)}
            saving={savingCard}
          />
        )}

        {editingCard && (
          <CardForm
            initial={{
              name: editingCard.name,
              institution: editingCard.institution || "",
              lastFour: editingCard.lastFour || "",
              creditLimit: editingCard.creditLimit,
              currentBalance: editingCard.currentBalance,
              apr: editingCard.apr || "",
              statementDueDay: editingCard.statementDueDay ? String(editingCard.statementDueDay) : "",
              minimumPayment: editingCard.minimumPayment || "",
              color: editingCard.color || "#6366f1",
            }}
            onSave={handleSaveCard}
            onCancel={() => setEditingCard(null)}
            saving={savingCard}
          />
        )}

        {loadingCards ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map(i => <div key={i} className="h-48 bg-white/5 rounded-2xl animate-pulse" />)}
          </div>
        ) : cards.length === 0 ? (
          <div className="p-10 text-center glass-panel rounded-2xl border border-white/10">
            <CreditCard className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No credit cards added yet</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Track your credit limits and utilization by adding a card above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cards.map(card => (
              editingCard?.id === card.id ? null : (
                <CreditCardCard
                  key={card.id}
                  card={card}
                  onEdit={() => { setEditingCard(card); setIsAddingCard(false); }}
                  onDelete={() => handleDeleteCard(card.id)}
                  expanded={!!expandedCards[card.id]}
                  onToggle={() => setExpandedCards(prev => ({ ...prev, [card.id]: !prev[card.id] }))}
                />
              )
            ))}
          </div>
        )}
      </section>

      <PlaidLinkSection onSuccess={refreshAccounts} />
    </div>
  );
}
