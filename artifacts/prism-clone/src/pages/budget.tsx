import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency, toNumber, cn } from "@/lib/utils";
import { PlusCircle, Pencil, Trash2, ChevronLeft, ChevronRight, PiggyBank, AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { API_BASE } from "@/lib/api-base";

const CATEGORIES = [
  "Housing",
  "Utilities",
  "Entertainment",
  "Subscriptions",
  "Insurance",
  "Health",
  "Food",
  "Transport",
] as const;

type Category = (typeof CATEGORIES)[number];

const CATEGORY_META: Record<Category, { emoji: string; gradient: string; bar: string; text: string; border: string }> = {
  Housing:        { emoji: "🏠", gradient: "from-amber-500/15  to-orange-500/10", bar: "bg-amber-400",   text: "text-amber-400",   border: "border-amber-500/25" },
  Utilities:      { emoji: "⚡", gradient: "from-blue-500/15   to-cyan-500/10",   bar: "bg-blue-400",    text: "text-blue-400",    border: "border-blue-500/25" },
  Entertainment:  { emoji: "🎬", gradient: "from-purple-500/15 to-pink-500/10",   bar: "bg-purple-400",  text: "text-purple-400",  border: "border-purple-500/25" },
  Subscriptions:  { emoji: "📦", gradient: "from-violet-500/15 to-indigo-500/10", bar: "bg-violet-400",  text: "text-violet-400",  border: "border-violet-500/25" },
  Insurance:      { emoji: "🛡️", gradient: "from-emerald-500/15 to-teal-500/10", bar: "bg-emerald-400", text: "text-emerald-400", border: "border-emerald-500/25" },
  Health:         { emoji: "❤️", gradient: "from-rose-500/15   to-red-500/10",    bar: "bg-rose-400",    text: "text-rose-400",    border: "border-rose-500/25" },
  Food:           { emoji: "🍔", gradient: "from-orange-500/15 to-yellow-500/10", bar: "bg-orange-400",  text: "text-orange-400",  border: "border-orange-500/25" },
  Transport:      { emoji: "🚗", gradient: "from-sky-500/15    to-blue-500/10",   bar: "bg-sky-400",     text: "text-sky-400",     border: "border-sky-500/25" },
};

function getMonthStr(offset: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return d.toISOString().slice(0, 7);
}

function formatMonthLabel(monthStr: string) {
  const [y, m] = monthStr.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function ProgressBar({ pct, barClass }: { pct: number; barClass: string }) {
  const clamped = Math.min(pct, 100);
  const over = pct > 100;
  return (
    <div className="h-2 w-full bg-white/8 rounded-full overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all duration-700", over ? "bg-rose-500" : barClass)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

interface BudgetSummary {
  id: number;
  category: string;
  limitAmount: string;
  spent: number;
}

interface BudgetModalProps {
  initial?: BudgetSummary | null;
  existingCategories: string[];
  onClose: () => void;
  onSave: (category: string, limit: number) => void;
}

function BudgetModal({ initial, existingCategories, onClose, onSave }: BudgetModalProps) {
  const [category, setCategory] = useState<Category>((initial?.category as Category) || CATEGORIES[0]);
  const [limit, setLimit] = useState(initial ? String(toNumber(initial.limitAmount)) : "");
  const isEdit = !!initial;

  const available = isEdit ? CATEGORIES : CATEGORIES.filter((c) => !existingCategories.includes(c));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = parseFloat(limit);
    if (isNaN(val) || val <= 0) return;
    onSave(category, val);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-card border border-white/10 rounded-2xl shadow-2xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-display font-bold text-white">{isEdit ? "Edit Budget" : "Add Budget"}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Category</label>
            {isEdit ? (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white">
                <span className="text-xl">{CATEGORY_META[category as Category]?.emoji}</span>
                <span className="font-semibold">{category}</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {available.map((cat) => {
                  const meta = CATEGORY_META[cat];
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all",
                        category === cat
                          ? `bg-gradient-to-br ${meta.gradient} ${meta.border} ${meta.text}`
                          : "border-white/8 bg-white/4 text-muted-foreground hover:bg-white/8 hover:text-white"
                      )}
                    >
                      <span className="text-base">{meta.emoji}</span>
                      {cat}
                    </button>
                  );
                })}
                {available.length === 0 && (
                  <p className="col-span-2 text-sm text-muted-foreground text-center py-4">All categories have budgets.</p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Monthly Limit</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">$</span>
              <input
                type="number"
                min="1"
                step="0.01"
                placeholder="0.00"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className="w-full pl-8 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors"
                required
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-muted-foreground hover:text-white hover:bg-white/5 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={available.length === 0 && !isEdit}
              className="flex-1 px-4 py-3 rounded-xl bg-primary hover:bg-primary/80 text-white font-semibold transition-colors disabled:opacity-40"
            >
              {isEdit ? "Save Changes" : "Add Budget"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BudgetPage() {
  const [monthOffset, setMonthOffset] = useState(0);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<BudgetSummary | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const qc = useQueryClient();
  const { toast } = useToast();
  const monthStr = getMonthStr(monthOffset);

  const { data: summary = [], isLoading } = useQuery<BudgetSummary[]>({
    queryKey: ["budgets", "summary", monthStr],
    queryFn: () => fetch(`${API_BASE}/budgets/summary?month=${monthStr}`).then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (body: { category: string; limitAmount: number }) =>
      fetch(`${API_BASE}/budgets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["budgets"] }); setModal(null); toast({ title: "Budget added" }); },
    onError: () => toast({ title: "Error", description: "Could not create budget", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, limitAmount }: { id: number; limitAmount: number }) =>
      fetch(`${API_BASE}/budgets/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limitAmount }) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["budgets"] }); setModal(null); setEditing(null); toast({ title: "Budget updated" }); },
    onError: () => toast({ title: "Error", description: "Could not update budget", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`${API_BASE}/budgets/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["budgets"] }); setDeleteConfirm(null); toast({ title: "Budget deleted" }); },
    onError: () => toast({ title: "Error", description: "Could not delete budget", variant: "destructive" }),
  });

  function handleSave(category: string, limitAmount: number) {
    if (editing) {
      updateMutation.mutate({ id: editing.id, limitAmount });
    } else {
      createMutation.mutate({ category, limitAmount });
    }
  }

  const totalBudget = summary.reduce((s, b) => s + toNumber(b.limitAmount), 0);
  const totalSpent = summary.reduce((s, b) => s + b.spent, 0);
  const totalRemaining = totalBudget - totalSpent;
  const overBudgetCount = summary.filter((b) => b.spent > toNumber(b.limitAmount)).length;

  const existingCategories = summary.map((b) => b.category);

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">Budget</h1>
          <p className="text-muted-foreground text-sm mt-1">Set monthly spending limits by category</p>
        </div>
        <button
          onClick={() => { setEditing(null); setModal("add"); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/80 text-white font-semibold text-sm transition-colors whitespace-nowrap"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Add Budget</span>
        </button>
      </div>

      {/* Month Picker */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMonthOffset((o) => o - 1)}
          className="p-2 rounded-xl bg-white/5 border border-white/10 text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="px-5 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-semibold text-sm min-w-[160px] text-center">
          {formatMonthLabel(monthStr)}
        </div>
        <button
          onClick={() => setMonthOffset((o) => Math.min(0, o + 1))}
          disabled={monthOffset >= 0}
          className="p-2 rounded-xl bg-white/5 border border-white/10 text-muted-foreground hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Summary Cards */}
      {summary.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Budget", value: formatCurrency(totalBudget), icon: PiggyBank, color: "text-primary" },
            { label: "Total Spent", value: formatCurrency(totalSpent), icon: TrendingUp, color: "text-amber-400" },
            { label: "Remaining", value: formatCurrency(Math.abs(totalRemaining)), icon: CheckCircle2, color: totalRemaining >= 0 ? "text-emerald-400" : "text-rose-400" },
            { label: "Over Budget", value: `${overBudgetCount} categor${overBudgetCount !== 1 ? "ies" : "y"}`, icon: AlertTriangle, color: overBudgetCount > 0 ? "text-rose-400" : "text-emerald-400" },
          ].map((s, i) => (
            <div key={i} className="glass-panel rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <s.icon className={cn("w-4 h-4", s.color)} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className={cn("text-lg font-bold font-display", s.color)}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Budget Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-panel rounded-2xl p-5 animate-pulse h-40" />
          ))}
        </div>
      ) : summary.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 flex flex-col items-center justify-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <PiggyBank className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white mb-1">No budgets yet</h3>
            <p className="text-muted-foreground text-sm max-w-xs">
              Set monthly spending limits by category. PrismClone will track your actual spending against each limit.
            </p>
          </div>
          <button
            onClick={() => { setEditing(null); setModal("add"); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/80 text-white font-semibold text-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Add your first budget
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {summary.map((budget) => {
            const meta = CATEGORY_META[budget.category as Category];
            const limit = toNumber(budget.limitAmount);
            const spent = budget.spent;
            const remaining = limit - spent;
            const pct = limit > 0 ? (spent / limit) * 100 : 0;
            const isOver = spent > limit;
            const isNear = !isOver && pct >= 80;

            return (
              <div
                key={budget.id}
                className={cn(
                  "glass-panel rounded-2xl p-5 border transition-all group",
                  isOver ? "border-rose-500/30 bg-rose-500/5" : meta?.border || "border-white/8"
                )}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-gradient-to-br", meta?.gradient || "from-white/10 to-white/5")}>
                      {meta?.emoji || "💰"}
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm">{budget.category}</p>
                      <p className="text-xs text-muted-foreground">Monthly limit</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditing(budget); setModal("edit"); }}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(budget.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5 mb-4">
                  <ProgressBar pct={pct} barClass={meta?.bar || "bg-primary"} />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{formatCurrency(spent)} spent</span>
                    <span className={cn("font-semibold", isOver ? "text-rose-400" : isNear ? "text-amber-400" : "text-muted-foreground")}>
                      {isOver ? `${formatCurrency(Math.abs(remaining))} over` : `${Math.round(pct)}%`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/8">
                  <div>
                    <p className="text-xs text-muted-foreground">Limit</p>
                    <p className={cn("text-base font-bold font-display", meta?.text || "text-white")}>{formatCurrency(limit)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Remaining</p>
                    <p className={cn("text-base font-bold font-display", isOver ? "text-rose-400" : "text-emerald-400")}>
                      {isOver ? "−" : ""}{formatCurrency(Math.abs(remaining))}
                    </p>
                  </div>
                </div>

                {isOver && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-rose-400">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Over budget by {formatCurrency(Math.abs(remaining))}
                  </div>
                )}
                {isNear && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Approaching limit ({Math.round(pct)}% used)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modal && (
        <BudgetModal
          initial={editing}
          existingCategories={existingCategories}
          onClose={() => { setModal(null); setEditing(null); }}
          onSave={handleSave}
        />
      )}

      {/* Delete Confirm */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}>
          <div className="w-full max-w-sm bg-card border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white">Delete Budget?</h3>
            <p className="text-sm text-muted-foreground">This will remove the budget limit for this category. Your spending history is not affected.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-muted-foreground hover:text-white transition-colors font-medium">Cancel</button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm)}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold transition-colors disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
