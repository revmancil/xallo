import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownLeft, ArrowUpRight, Receipt, Search, SlidersHorizontal,
  X, Loader2, TrendingDown, TrendingUp, Minus, RefreshCw,
  CircleDot, Landmark,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

const API_BASE = import.meta.env.BASE_URL + "api";

type Transaction = {
  id: string;
  source: "plaid" | "bill";
  date: string;
  name: string;
  category: string;
  amount: number;
  accountName: string;
  accountType: string;
  pending: boolean;
  confirmationNumber?: string | null;
  logo?: string | null;
};

type Summary = {
  totalSpent: number;
  totalIncome: number;
  net: number;
  count: number;
};

const RANGES = [
  { label: "7 days",  days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "1 year",  days: 365 },
] as const;

function getRange(days: number) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

const CATEGORY_COLORS: Record<string, string> = {
  "Bills":          "bg-violet-500/15 text-violet-300",
  "Food":           "bg-orange-500/15 text-orange-300",
  "Shopping":       "bg-pink-500/15 text-pink-300",
  "Transportation": "bg-blue-500/15 text-blue-300",
  "Entertainment":  "bg-yellow-500/15 text-yellow-300",
  "Health":         "bg-emerald-500/15 text-emerald-300",
  "Travel":         "bg-cyan-500/15 text-cyan-300",
  "Utilities":      "bg-amber-500/15 text-amber-300",
  "Income":         "bg-green-500/15 text-green-300",
  "Transfer":       "bg-slate-500/15 text-slate-300",
};

function categoryColor(cat: string) {
  for (const key of Object.keys(CATEGORY_COLORS)) {
    if (cat.toLowerCase().includes(key.toLowerCase())) return CATEGORY_COLORS[key];
  }
  return "bg-white/10 text-white/60";
}

function groupByDate(txs: Transaction[]): [string, Transaction[]][] {
  const map = new Map<string, Transaction[]>();
  for (const tx of txs) {
    const arr = map.get(tx.date) ?? [];
    arr.push(tx);
    map.set(tx.date, arr);
  }
  return Array.from(map.entries());
}

function formatDateHeader(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export default function Transactions() {
  const [rangeDays, setRangeDays]         = useState(30);
  const [search, setSearch]               = useState("");
  const [sourceFilter, setSourceFilter]   = useState<"all" | "plaid" | "bills">("all");
  const [showFilters, setShowFilters]     = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [amountFilter, setAmountFilter]   = useState<"all" | "debits" | "credits">("all");

  const { startDate, endDate } = getRange(rangeDays);

  const { data, isLoading, isFetching, refetch } = useQuery<{
    transactions: Transaction[];
    summary: Summary;
  }>({
    queryKey: ["transactions", startDate, endDate, sourceFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate, source: sourceFilter });
      const r = await fetch(`${API_BASE}/transactions?${params}`);
      if (!r.ok) throw new Error("Failed to load transactions");
      return r.json();
    },
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    if (!data?.transactions) return [];
    return data.transactions.filter(tx => {
      if (
        search &&
        !tx.name.toLowerCase().includes(search.toLowerCase()) &&
        !tx.category.toLowerCase().includes(search.toLowerCase()) &&
        !tx.accountName.toLowerCase().includes(search.toLowerCase())
      ) return false;
      if (selectedCategory && tx.category !== selectedCategory) return false;
      if (amountFilter === "debits" && tx.amount >= 0) return false;
      if (amountFilter === "credits" && tx.amount < 0) return false;
      return true;
    });
  }, [data?.transactions, search, selectedCategory, amountFilter]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  const categories = useMemo(() => {
    if (!data?.transactions) return [];
    return Array.from(new Set(data.transactions.map(tx => tx.category))).sort();
  }, [data?.transactions]);

  const summary = data?.summary;
  const hasActiveFilter = !!selectedCategory || amountFilter !== "all";

  return (
    <div className="space-y-5">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-gradient">Transaction Register</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            All activity from connected bank &amp; credit card accounts
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-muted-foreground hover:text-white transition-all"
        >
          <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <SummaryCard
            label="Total Spent"
            value={summary.totalSpent}
            icon={<TrendingDown className="w-4 h-4" />}
            color="text-rose-400"
            bg="bg-rose-500/10"
            prefix="-"
          />
          <SummaryCard
            label="Total Income"
            value={summary.totalIncome}
            icon={<TrendingUp className="w-4 h-4" />}
            color="text-emerald-400"
            bg="bg-emerald-500/10"
            prefix="+"
          />
          <SummaryCard
            label="Net Cash Flow"
            value={Math.abs(summary.net)}
            icon={<Minus className="w-4 h-4" />}
            color={summary.net >= 0 ? "text-emerald-400" : "text-rose-400"}
            bg={summary.net >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10"}
            prefix={summary.net >= 0 ? "+" : "-"}
            sub={`${summary.count} transactions`}
          />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search transactions…"
            className="w-full pl-9 pr-9 py-2 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Date range pills */}
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
          {RANGES.map(r => (
            <button
              key={r.days}
              onClick={() => setRangeDays(r.days)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                rangeDays === r.days
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted-foreground hover:text-white"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Source pills */}
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
          {(["all", "plaid", "bills"] as const).map(s => (
            <button
              key={s}
              onClick={() => setSourceFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                sourceFilter === s
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted-foreground hover:text-white"
              )}
            >
              {s === "all" ? "All Sources" : s === "plaid" ? "Bank/CC" : "Bills"}
            </button>
          ))}
        </div>

        {/* Filters toggle */}
        <button
          onClick={() => setShowFilters(v => !v)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl border text-sm transition-all",
            showFilters
              ? "bg-primary/20 border-primary/40 text-primary"
              : "bg-white/5 border-white/10 text-muted-foreground hover:text-white"
          )}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {hasActiveFilter && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
        </button>
      </div>

      {/* Expanded filter panel */}
      {showFilters && (
        <div className="flex flex-wrap gap-4 p-4 rounded-xl bg-white/3 border border-white/8">
          <div>
            <p className="text-xs text-muted-foreground mb-2">Direction</p>
            <div className="flex gap-1">
              {(["all", "debits", "credits"] as const).map(a => (
                <button
                  key={a}
                  onClick={() => setAmountFilter(a)}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-medium border transition-all",
                    amountFilter === a
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "bg-white/5 border-white/10 text-muted-foreground hover:text-white"
                  )}
                >
                  {a === "all" ? "All" : a === "debits" ? "Spent" : "Received"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-w-64">
            <p className="text-xs text-muted-foreground mb-2">Category</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                  !selectedCategory
                    ? "bg-primary/20 border-primary/40 text-primary"
                    : "bg-white/5 border-white/10 text-muted-foreground hover:text-white"
                )}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                    selectedCategory === cat
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "bg-white/5 border-white/10 text-muted-foreground hover:text-white"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {hasActiveFilter && (
            <button
              onClick={() => { setSelectedCategory(null); setAmountFilter("all"); }}
              className="self-end px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-white border border-white/10 hover:bg-white/5 transition-all"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Transaction list */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState hasSearch={!!search || !!selectedCategory} />
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, txs]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                  {formatDateHeader(date)}
                </p>
                <div className="flex-1 h-px bg-white/10" />
                <p className="text-xs text-muted-foreground">
                  {txs.length} {txs.length === 1 ? "transaction" : "transactions"}
                </p>
              </div>
              <div className="space-y-1.5">
                {txs.map(tx => (
                  <TransactionRow key={tx.id} tx={tx} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SummaryCard({
  label, value, icon, color, bg, prefix, sub,
}: {
  label: string; value: number; icon: React.ReactNode;
  color: string; bg: string; prefix?: string; sub?: string;
}) {
  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", bg, color)}>
          {icon}
        </div>
      </div>
      <p className={cn("text-xl font-bold font-display", color)}>
        {prefix}{formatCurrency(value)}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function TxAvatar({ tx }: { tx: Transaction }) {
  if (tx.logo) {
    return (
      <img
        src={tx.logo}
        alt={tx.name}
        className="w-10 h-10 rounded-full object-cover bg-white/5 border border-white/10 shrink-0"
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  const isDebit = tx.amount < 0;
  return (
    <div className={cn(
      "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
      isDebit ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"
    )}>
      {isDebit
        ? <ArrowDownLeft className="w-5 h-5" />
        : <ArrowUpRight className="w-5 h-5" />}
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  if (source === "plaid") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-medium">
        <Landmark className="w-2.5 h-2.5" /> Bank
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 font-medium">
      <Receipt className="w-2.5 h-2.5" /> Bill
    </span>
  );
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const isDebit = tx.amount < 0;
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/3 hover:bg-white/6 border border-white/6 hover:border-white/12 transition-all">
      <TxAvatar tx={tx} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-medium text-white truncate">{tx.name}</p>
          {tx.pending && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium shrink-0">
              <CircleDot className="w-2.5 h-2.5" /> Pending
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SourceBadge source={tx.source} />
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", categoryColor(tx.category))}>
            {tx.category}
          </span>
          {tx.accountName && tx.accountName !== "Bill Payment" && (
            <span className="text-[10px] text-muted-foreground truncate">{tx.accountName}</span>
          )}
          {tx.confirmationNumber && (
            <span className="text-[10px] text-muted-foreground">Conf: {tx.confirmationNumber}</span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className={cn(
          "text-base font-bold font-display tabular-nums",
          isDebit ? "text-rose-400" : "text-emerald-400"
        )}>
          {isDebit ? "−" : "+"}{formatCurrency(Math.abs(tx.amount))}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {new Date(tx.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {[0, 1, 2].map(g => (
        <div key={g}>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-3 w-24 rounded-full bg-white/10 animate-pulse" />
            <div className="flex-1 h-px bg-white/10" />
          </div>
          <div className="space-y-1.5">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/3 border border-white/6">
                <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 rounded-full bg-white/10 animate-pulse" />
                  <div className="h-2 w-24 rounded-full bg-white/8 animate-pulse" />
                </div>
                <div className="h-4 w-16 rounded-full bg-white/10 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
        <Receipt className="w-8 h-8 text-muted-foreground/40" />
      </div>
      <h3 className="text-base font-semibold text-muted-foreground mb-1">
        {hasSearch ? "No matching transactions" : "No transactions found"}
      </h3>
      <p className="text-sm text-muted-foreground/60 max-w-xs">
        {hasSearch
          ? "Try adjusting your search or filters"
          : "Connect a bank account via Plaid, or mark some bills as paid to see activity here"}
      </p>
    </div>
  );
}
