import { useState } from "react";
import { useGetBillers, useCreateBiller, getGetBillersQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import {
  Mail, RefreshCw, Loader2, CheckCircle2, AlertTriangle,
  X, Plus, UserPlus, Trash2, ChevronDown, ChevronUp,
  Sparkles, InboxIcon,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const API_BASE = import.meta.env.BASE_URL + "api";

type EmailImport = {
  id: number;
  gmailMessageId: string;
  fromEmail: string;
  subject: string;
  receivedAt: string;
  amountDue: string | null;
  dueDate: string | null;
  billerHint: string | null;
  billInstanceId: number | null;
  status: string;
};

export default function GmailImport() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; skipped: number } | null>(null);
  const [syncError, setSyncError] = useState("");
  const [imports, setImports] = useState<EmailImport[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [billerSelections, setBillerSelections] = useState<Record<number, string>>({});
  const [creatingBill, setCreatingBill] = useState<Record<number, boolean>>({});
  const [showNewBiller, setShowNewBiller] = useState<Record<number, boolean>>({});
  const [newBillerName, setNewBillerName] = useState<Record<number, string>>({});
  const [newBillerCategory, setNewBillerCategory] = useState<Record<number, string>>({});
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const { data: billers } = useGetBillers();
  const queryClient = useQueryClient();
  const createBillerMutation = useCreateBiller({
    mutation: {
      onSuccess: (newBiller: any, _vars, ctx: any) => {
        queryClient.invalidateQueries({ queryKey: getGetBillersQueryKey() });
        const importId = ctx as number;
        setBillerSelections(prev => ({ ...prev, [importId]: String(newBiller.id) }));
        setShowNewBiller(prev => ({ ...prev, [importId]: false }));
        setNewBillerName(prev => ({ ...prev, [importId]: "" }));
      }
    }
  });

  const loadImports = async () => {
    try {
      const res = await fetch(`${API_BASE}/gmail/imports`);
      const data = await res.json();
      if (Array.isArray(data)) setImports(data);
      setLoaded(true);
    } catch {}
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncError("");
    setSyncResult(null);
    try {
      const res = await fetch(`${API_BASE}/gmail/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setSyncResult({ synced: data.synced, skipped: data.skipped });
      await loadImports();
    } catch (e: any) {
      setSyncError(e.message || "Failed to sync Gmail");
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateBill = async (imp: EmailImport) => {
    const billerId = billerSelections[imp.id];
    if (!billerId) return;
    setCreatingBill(prev => ({ ...prev, [imp.id]: true }));
    try {
      const res = await fetch(`${API_BASE}/gmail/imports/${imp.id}/create-bill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billerId: parseInt(billerId) }),
      });
      if (!res.ok) throw new Error("Failed to create bill");
      setImports(prev => prev.map(i => i.id === imp.id ? { ...i, status: "imported" } : i));
    } catch {}
    setCreatingBill(prev => ({ ...prev, [imp.id]: false }));
  };

  const handleDismiss = async (id: number) => {
    await fetch(`${API_BASE}/gmail/imports/${id}`, { method: "DELETE" });
    setImports(prev => prev.filter(i => i.id !== id));
  };

  const handleCreateBiller = (importId: number) => {
    const name = newBillerName[importId]?.trim();
    const category = newBillerCategory[importId] || "Utilities";
    if (!name) return;
    createBillerMutation.mutate({ data: { name, category } }, { onSuccess: (_d: any) => {}, context: importId });
  };

  // Group by status
  const ready = imports.filter(i => i.status === "ready");
  const noData = imports.filter(i => i.status === "no_data");
  const imported = imports.filter(i => i.status === "imported");

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-gradient mb-2">Gmail Import</h1>
          <p className="text-muted-foreground">
            Scan your Gmail inbox for bill emails and add them automatically.
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold shadow-lg shadow-primary/25 transition-all disabled:opacity-50"
        >
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {syncing ? "Scanning Gmail…" : "Scan Gmail Now"}
        </button>
      </div>

      {/* Info banner */}
      {!loaded && !syncing && (
        <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
          <Mail className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-300">Connected to Gmail</p>
            <p className="text-xs text-blue-400/70 mt-0.5">
              Click "Scan Gmail Now" to search your last 90 days of emails for bills. We look for keywords
              like "amount due", "payment due", and "billing statement". Your emails are never stored — only
              the extracted bill data is saved.
            </p>
          </div>
        </div>
      )}

      {/* Sync error */}
      {syncError && (
        <div className="flex items-center gap-2 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-sm text-rose-300">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {syncError}
        </div>
      )}

      {/* Sync result banner */}
      {syncResult && (
        <div className="flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl animate-in fade-in">
          <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-300">
              Scan complete — {syncResult.synced} new email{syncResult.synced !== 1 ? "s" : ""} found
            </p>
            <p className="text-xs text-emerald-400/70 mt-0.5">
              {syncResult.skipped} already seen. Emails with a detected amount &amp; due date are ready to add.
            </p>
          </div>
          <button onClick={() => setSyncResult(null)} className="text-emerald-400/60 hover:text-emerald-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Ready to import */}
      {loaded && ready.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            Ready to add ({ready.length})
          </h2>
          {ready.map(imp => (
            <ImportCard
              key={imp.id}
              imp={imp}
              billers={billers || []}
              billerId={billerSelections[imp.id] || ""}
              onBillerChange={(v) => { setBillerSelections(prev => ({ ...prev, [imp.id]: v })); setShowNewBiller(prev => ({ ...prev, [imp.id]: false })); }}
              onAddBill={() => handleCreateBill(imp)}
              addingBill={!!creatingBill[imp.id]}
              onDismiss={() => handleDismiss(imp.id)}
              showNew={!!showNewBiller[imp.id]}
              onToggleNew={() => setShowNewBiller(prev => ({ ...prev, [imp.id]: !prev[imp.id] }))}
              newName={newBillerName[imp.id] || ""}
              onNewName={(v) => setNewBillerName(prev => ({ ...prev, [imp.id]: v }))}
              newCategory={newBillerCategory[imp.id] || "Utilities"}
              onNewCategory={(v) => setNewBillerCategory(prev => ({ ...prev, [imp.id]: v }))}
              onCreateBiller={() => handleCreateBiller(imp.id)}
              creatingBiller={createBillerMutation.isPending}
              expanded={!!expanded[imp.id]}
              onToggleExpand={() => setExpanded(prev => ({ ...prev, [imp.id]: !prev[imp.id] }))}
            />
          ))}
        </section>
      )}

      {/* No bill data found */}
      {loaded && noData.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            No bill data extracted ({noData.length})
          </h2>
          {noData.map(imp => (
            <div key={imp.id} className="glass-panel rounded-xl border border-white/10 px-4 py-3 flex items-center gap-3">
              <Mail className="w-4 h-4 text-muted-foreground/50 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{imp.subject}</p>
                <p className="text-xs text-muted-foreground">{imp.billerHint} · {imp.receivedAt ? format(parseISO(imp.receivedAt), "MMM d, yyyy") : ""}</p>
              </div>
              <span className="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full shrink-0">No data</span>
              <button onClick={() => handleDismiss(imp.id)} className="text-muted-foreground/40 hover:text-rose-400 transition-colors shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </section>
      )}

      {/* Already imported */}
      {loaded && imported.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
            Already imported ({imported.length})
          </h2>
          {imported.map(imp => (
            <div key={imp.id} className="glass-panel rounded-xl border border-white/10 px-4 py-3 flex items-center gap-3 opacity-60">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{imp.subject}</p>
                <p className="text-xs text-muted-foreground">{imp.billerHint} · {imp.receivedAt ? format(parseISO(imp.receivedAt), "MMM d, yyyy") : ""}</p>
              </div>
              {imp.amountDue && <span className="text-sm font-bold text-white shrink-0">{formatCurrency(imp.amountDue)}</span>}
              <span className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">Imported</span>
            </div>
          ))}
        </section>
      )}

      {/* Empty state */}
      {loaded && imports.length === 0 && !syncing && (
        <div className="p-12 text-center glass-panel rounded-2xl border border-white/10">
          <InboxIcon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No bill emails found yet</p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            Try scanning — we'll search for "amount due", "payment due", and similar keywords.
          </p>
        </div>
      )}
    </div>
  );
}

function ImportCard({
  imp, billers, billerId, onBillerChange, onAddBill, addingBill, onDismiss,
  showNew, onToggleNew, newName, onNewName, newCategory, onNewCategory,
  onCreateBiller, creatingBiller, expanded, onToggleExpand,
}: {
  imp: EmailImport; billers: any[]; billerId: string;
  onBillerChange: (v: string) => void; onAddBill: () => void; addingBill: boolean;
  onDismiss: () => void; showNew: boolean; onToggleNew: () => void;
  newName: string; onNewName: (v: string) => void;
  newCategory: string; onNewCategory: (v: string) => void;
  onCreateBiller: () => void; creatingBiller: boolean;
  expanded: boolean; onToggleExpand: () => void;
}) {
  return (
    <div className="glass-panel rounded-2xl border border-primary/20 overflow-hidden">
      {/* Main row */}
      <div className="px-4 py-3 flex items-center gap-3">
        <Mail className="w-4 h-4 text-primary/70 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{imp.subject}</p>
          <p className="text-xs text-muted-foreground">
            {imp.billerHint}
            {imp.receivedAt ? ` · ${format(parseISO(imp.receivedAt), "MMM d, yyyy")}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {imp.amountDue && (
            <span className="text-sm font-bold text-white">{formatCurrency(imp.amountDue)}</span>
          )}
          {imp.dueDate && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              Due {format(parseISO(imp.dueDate), "MMM d")}
            </span>
          )}
          <button onClick={onToggleExpand} className="text-muted-foreground hover:text-white transition-colors p-1">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button onClick={onDismiss} className="text-muted-foreground/40 hover:text-rose-400 transition-colors p-1">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded: biller assignment */}
      {expanded && (
        <div className="border-t border-white/10 px-4 py-3 space-y-3 bg-white/[0.02]">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
            <div>
              <p className="text-muted-foreground mb-0.5">From</p>
              <p className="text-white font-medium truncate">{imp.fromEmail || imp.billerHint}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-0.5">Amount</p>
              <p className="text-white font-bold">{imp.amountDue ? formatCurrency(imp.amountDue) : "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-0.5">Due Date</p>
              <p className="text-white font-medium">{imp.dueDate ? format(parseISO(imp.dueDate), "MMM d, yyyy") : "—"}</p>
            </div>
          </div>

          {/* Biller selector + add button */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={billerId}
              onChange={e => onBillerChange(e.target.value)}
              className="flex-1 min-w-0 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary outline-none"
            >
              <option value="">Assign to biller…</option>
              {billers.map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <button
              onClick={onAddBill}
              disabled={!billerId || addingBill}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-primary/25 shrink-0"
            >
              {addingBill ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add to Bills
            </button>
          </div>

          {/* Quick biller create */}
          {!showNew ? (
            <button onClick={onToggleNew} className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors">
              <UserPlus className="w-3.5 h-3.5" /> Biller not in list? Create one
            </button>
          ) : (
            <div className="space-y-2 pt-1 border-t border-white/10">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Biller</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Biller name…"
                  value={newName}
                  onChange={e => onNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") onCreateBiller(); if (e.key === "Escape") onToggleNew(); }}
                  autoFocus
                  className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-violet-500 outline-none placeholder:text-muted-foreground/50"
                />
                <select
                  value={newCategory}
                  onChange={e => onNewCategory(e.target.value)}
                  className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-violet-500 outline-none"
                >
                  {["Housing","Utilities","Entertainment","Subscriptions","Insurance","Health","Food","Transport"].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onCreateBiller}
                  disabled={!newName.trim() || creatingBiller}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-all disabled:opacity-50"
                >
                  {creatingBiller ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Create &amp; Select
                </button>
                <button onClick={onToggleNew} className="text-xs text-muted-foreground hover:text-white transition-colors px-2 py-1.5">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
