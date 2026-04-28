import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { formatCurrency, toNumber } from "@/lib/utils";
import { BillerIcon } from "@/components/biller-icon";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, BarChart2, Star } from "lucide-react";

import { API_BASE } from "@/lib/api-base";

function useMonthlyData() {
  return useQuery({
    queryKey: ["analytics", "monthly"],
    queryFn: () => fetch(`${API_BASE}/analytics/monthly`).then(r => r.json()),
  });
}

function useSubscriptionChanges() {
  return useQuery({
    queryKey: ["analytics", "subscription-changes"],
    queryFn: () => fetch(`${API_BASE}/analytics/subscription-changes`).then(r => r.json()),
  });
}

function useAnalyticsSummary() {
  return useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: () => fetch(`${API_BASE}/analytics/summary`).then(r => r.json()),
  });
}


const CustomTooltipWithFuture = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const isFuture = payload[0].payload.is_future;
    return (
      <div className="glass-panel px-4 py-3 rounded-xl border border-white/10 shadow-xl">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-semibold text-white">{label}</p>
          {isFuture && (
            <span className="text-xs font-medium text-blue-300 bg-blue-500/15 border border-blue-500/20 px-1.5 py-0.5 rounded-full">
              Forecast
            </span>
          )}
        </div>
        <p className="text-primary font-display font-bold text-lg">{formatCurrency(payload[0].value)}</p>
        <p className="text-xs text-muted-foreground">{payload[0].payload.count} bill{payload[0].payload.count !== 1 ? "s" : ""}</p>
      </div>
    );
  }
  return null;
};

function SpendingTrends() {
  const { data, isLoading } = useMonthlyData();

  const maxVal = data ? Math.max(...data.map((d: any) => toNumber(d.total) || 0)) : 0;
  const hasFuture = data?.some((d: any) => d.is_future);
  const hasPast = data?.some((d: any) => !d.is_future);

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h2 className="text-lg font-bold text-white mb-1">Monthly Bill Totals</h2>
            <p className="text-sm text-muted-foreground">Past 3 months of history + next 2 months forecast</p>
          </div>
          {hasFuture && hasPast && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-violet-500/60 inline-block" /> Actual
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-blue-500/40 inline-block border border-blue-400/40 border-dashed" /> Forecast
              </span>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="h-64 bg-white/5 rounded-xl animate-pulse" />
        ) : !data?.length ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
            No billing data yet — add some bills to see trends.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
                width={50}
              />
              <Tooltip content={<CustomTooltipWithFuture />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                {data.map((entry: any, index: number) => {
                  const isFuture = entry.is_future;
                  const isCurrentMonth = !isFuture && index === data.filter((d: any) => !d.is_future).length - 1;
                  const isMax = !isFuture && toNumber(entry.total) === maxVal;
                  if (isFuture) {
                    return <Cell key={index} fill="rgba(96,165,250,0.35)" />;
                  }
                  return (
                    <Cell
                      key={index}
                      fill={isCurrentMonth ? "url(#primaryGrad)" : isMax ? "rgba(139,92,246,0.6)" : "rgba(139,92,246,0.3)"}
                    />
                  );
                })}
              </Bar>
              <defs>
                <linearGradient id="primaryGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#6d28d9" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <TopBillers />
    </div>
  );
}

function TopBillers() {
  const { data, isLoading } = useAnalyticsSummary();

  if (isLoading) return <div className="h-40 bg-white/5 rounded-2xl animate-pulse" />;

  const billers = data?.topBillers || [];
  const maxSpend = Math.max(...billers.map((b: any) => toNumber(b.total_spent) || 0));

  return (
    <div className="glass-panel rounded-2xl p-6">
      <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
        <Star className="w-4 h-4 text-primary" /> Top 5 Billers
      </h2>
      <p className="text-sm text-muted-foreground mb-5">Highest total spend over the last 6 months</p>

      <div className="space-y-3">
        {billers.map((b: any, i: number) => {
          const pct = maxSpend > 0 ? (toNumber(b.total_spent) / maxSpend) * 100 : 0;
          return (
            <div key={i} className="flex items-center gap-3">
              <BillerIcon icon={b.icon} category={b.category} name={b.name} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-white truncate">{b.name}</span>
                  <span className="text-sm font-bold text-white ml-2 shrink-0">{formatCurrency(b.total_spent)}</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-blue-500 rounded-full transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubscriptionWatcher() {
  const { data, isLoading } = useSubscriptionChanges();
  const changes = (data || []) as any[];
  const flagged = changes.filter((c: any) => Math.abs(toNumber(c.change_pct)) > 10);
  const stable = changes.filter((c: any) => Math.abs(toNumber(c.change_pct)) <= 10);

  return (
    <div className="space-y-6">
      {flagged.length > 0 && (
        <div className="glass-panel rounded-2xl p-6 border border-amber-500/20">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-white">Price Changes Detected</h2>
            <span className="ml-auto text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
              {flagged.length} alert{flagged.length !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-5">These billers changed their amount by more than 10% month-over-month.</p>

          <div className="space-y-3">
            {flagged.map((c: any, i: number) => {
              const pct = toNumber(c.change_pct);
              const isIncrease = pct > 0;
              return (
                <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-white/3 border border-white/5">
                  <BillerIcon icon={c.icon} category={c.category} name={c.biller_name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm">{c.biller_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(c.previous_amount)} → {formatCurrency(c.current_amount)}
                    </p>
                  </div>
                  <div className={`flex items-center gap-1 font-bold text-sm px-3 py-1 rounded-full ${
                    isIncrease
                      ? "text-rose-300 bg-rose-500/10 border border-rose-500/20"
                      : "text-emerald-300 bg-emerald-500/10 border border-emerald-500/20"
                  }`}>
                    {isIncrease ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {isIncrease ? "+" : ""}{pct}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="h-40 bg-white/5 rounded-2xl animate-pulse" />
      ) : changes.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center">
          <BarChart2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-lg font-bold text-white">No comparison data yet</p>
          <p className="text-sm text-muted-foreground">Subscription Watcher compares current vs. previous month amounts. Check back after your first billing cycle.</p>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
            <Minus className="w-4 h-4 text-emerald-400" /> Stable Subscriptions
          </h2>
          <p className="text-sm text-muted-foreground mb-5">These billers have not changed their price significantly.</p>
          <div className="space-y-2">
            {stable.map((c: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/3 transition-colors">
                <BillerIcon icon={c.icon} category={c.category} name={c.biller_name} size="sm" />
                <div className="flex-1">
                  <span className="text-sm font-medium text-white">{c.biller_name}</span>
                </div>
                <span className="text-sm text-muted-foreground">{formatCurrency(c.current_amount)}</span>
                <div className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
                  <Minus className="w-3 h-3" /> Stable
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Analytics() {
  const [tab, setTab] = useState<"trends" | "watcher">("trends");

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-gradient mb-2">Analytics</h1>
          <p className="text-muted-foreground">Spending trends and subscription intelligence.</p>
        </div>

        <div className="flex items-center gap-1 bg-card border border-white/10 rounded-xl p-1 w-fit">
          <button
            onClick={() => setTab("trends")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === "trends" ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:text-white hover:bg-white/5"
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" /> Spending Trends
          </button>
          <button
            onClick={() => setTab("watcher")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === "watcher" ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:text-white hover:bg-white/5"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" /> Subscription Watcher
          </button>
        </div>
      </div>

      {tab === "trends" ? <SpendingTrends /> : <SubscriptionWatcher />}
    </div>
  );
}
