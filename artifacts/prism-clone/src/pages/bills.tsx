import { useState, useEffect, lazy, Suspense } from "react";
import {
  useGetBillInstances,
  useUpdateBillInstance,
  useCreateBillInstance,
  useDeleteBillInstance,
  useGetBillers,
  useCreateBiller,
  getGetBillInstancesQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetBillersQueryKey,
} from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import { BillerIcon } from "@/components/biller-icon";
import { format, parseISO } from "date-fns";
import {
  CheckCircle2, Check, History, Hash, X, Plus,
  Pencil, Trash2, Loader2, CalendarDays, FileScan,
  Upload, AlertTriangle, Sparkles, RefreshCw, Receipt, UserPlus, CreditCard,
} from "lucide-react";
import { PayBillModal } from "@/components/pay-bill-modal";
import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { API_BASE } from "@/lib/api-base";

type ConfirmDialog = { billId: number; confirmationNumber: string };
type EditForm = { billId: number; amountDue: string; dueDate: string; status: string };
type ScanResult = { amountDue: number | null; dueDate: string | null; billerHint: string | null; confidence: string; pages: number };

const STATUS_OPTIONS = ["unpaid", "scheduled", "paid", "overdue"];

export default function Bills() {
  const [filter, setFilter] = useState<string>("all");
  const [view, setView] = useState<"bills" | "history">("bills");
  const [justPaidIds, setJustPaidIds] = useState<Set<number>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanBillerId, setScanBillerId] = useState("");
  const [scanSaved, setScanSaved] = useState(false);
  const [showNewBiller, setShowNewBiller] = useState(false);
  const [newBillerName, setNewBillerName] = useState("");
  const [newBillerCategory, setNewBillerCategory] = useState("Utilities");
  const [savingBiller, setSavingBiller] = useState(false);
  const scanFileRef = useRef<HTMLInputElement>(null);
  const [autoFillBanner, setAutoFillBanner] = useState<{ count: number; names: string[] } | null>(null);
  const [autoFilling, setAutoFilling] = useState(false);
  const [payingBillId, setPayingBillId] = useState<number | null>(null);

  const { data: bills, isLoading } = useGetBillInstances();
  const { data: billers } = useGetBillers();
  const queryClient = useQueryClient();

  const runAutoFill = async (silent = false) => {
    if (!silent) setAutoFilling(true);
    try {
      const res = await fetch(`${API_BASE}/bills/generate-recurring`, { method: "POST" });
      const data = await res.json();
      if (data.count > 0) {
        const uniqueNames = [...new Set(data.created.map((c: any) => c.biller))] as string[];
        setAutoFillBanner({ count: data.count, names: uniqueNames });
        invalidate();
      }
    } catch {}
    if (!silent) setAutoFilling(false);
  };

  // Silently auto-fill recurring bills on first load
  useEffect(() => { runAutoFill(true); }, []);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetBillInstancesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const updateMutation = useUpdateBillInstance({ mutation: { onSuccess: invalidate } });
  const createMutation = useCreateBillInstance({ mutation: { onSuccess: () => { invalidate(); setIsAdding(false); } } });
  const deleteMutation = useDeleteBillInstance({ mutation: { onSuccess: invalidate } });
  const createBillerMutation = useCreateBiller({
    mutation: {
      onSuccess: (newBiller: any) => {
        queryClient.invalidateQueries({ queryKey: getGetBillersQueryKey() });
        setScanBillerId(String(newBiller.id));
        setShowNewBiller(false);
        setNewBillerName("");
        setNewBillerCategory("Utilities");
      }
    }
  });

  const handleCreateScanBiller = () => {
    if (!newBillerName.trim()) return;
    createBillerMutation.mutate({ data: { name: newBillerName.trim(), category: newBillerCategory } });
  };

  const handleMarkPaidClick = (id: number) => {
    setConfirmDialog({ billId: id, confirmationNumber: "" });
  };

  const handleConfirmPaid = (skip = false) => {
    if (!confirmDialog) return;
    const { billId, confirmationNumber } = confirmDialog;
    setJustPaidIds(prev => new Set(prev).add(billId));
    updateMutation.mutate({
      billId,
      data: {
        status: "paid",
        paidAt: new Date().toISOString(),
        ...((!skip && confirmationNumber) ? { confirmationNumber } : {}),
      }
    });
    setConfirmDialog(null);
    setTimeout(() => {
      setJustPaidIds(prev => { const s = new Set(prev); s.delete(billId); return s; });
    }, 1600);
  };

  const handleScanFile = async (file: File) => {
    setScanning(true);
    setScanError("");
    setScanResult(null);
    setScanSaved(false);
    setScanBillerId("");
    setShowNewBiller(false);
    setNewBillerName("");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`${API_BASE}/pdf/parse`, { method: "POST", body: fd });
      let data: any;
      try {
        data = await res.json();
      } catch {
        throw new Error("The server returned an unexpected response. The file may be too large or the upload was interrupted.");
      }
      if (!res.ok) throw new Error(data?.error || `Upload failed (${res.status})`);
      setScanResult(data);
    } catch (e: any) {
      setScanError(e.message || "Failed to parse PDF.");
    } finally {
      setScanning(false);
    }
  };

  const handleScanSave = () => {
    if (!scanResult?.amountDue || !scanResult?.dueDate || !scanBillerId) return;
    createMutation.mutate({
      data: { billerId: parseInt(scanBillerId), amountDue: scanResult.amountDue, dueDate: scanResult.dueDate, status: "unpaid" }
    }, {
      onSuccess: () => { setScanSaved(true); }
    });
  };

  const handleAddSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      data: {
        billerId: Number(fd.get("billerId")),
        amountDue: Number(fd.get("amountDue")),
        dueDate: fd.get("dueDate") as string,
        status: (fd.get("status") as string) || "unpaid",
      }
    });
  };

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editForm) return;
    updateMutation.mutate({
      billId: editForm.billId,
      data: {
        amountDue: Number(editForm.amountDue),
        dueDate: editForm.dueDate,
        status: editForm.status,
      }
    });
    setEditForm(null);
  };

  const handleDelete = (billId: number) => {
    if (!confirm("Remove this bill?")) return;
    deleteMutation.mutate({ billId });
  };

  const filteredBills = bills?.filter(b => {
    if (view === "history") return b.status === "paid";
    return filter === "all" || b.status === filter;
  }) || [];

  const paidBills = [...(bills || [])]
    .filter(b => b.status === "paid")
    .sort((a, b) => {
      const at = a.paidAt ? new Date(a.paidAt).getTime() : 0;
      const bt = b.paidAt ? new Date(b.paidAt).getTime() : 0;
      return bt - at;
    });

  const FILTERS = ["all", "unpaid", "scheduled", "paid", "overdue"];

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-gradient mb-2">
            {view === "history" ? "Payment History" : "All Bills"}
          </h1>
          <p className="text-muted-foreground">
            {view === "history"
              ? "A complete audit log of all paid bills."
              : "Manage and track all your scheduled payments."}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {view === "bills" && (
            <>
              <button
                onClick={() => runAutoFill(false)}
                disabled={autoFilling}
                title="Auto-generate upcoming bills from recurring billers"
                className="flex items-center gap-2 px-3 py-2 rounded-xl font-semibold border border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
              >
                {autoFilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span className="hidden sm:inline text-sm">Auto-fill</span>
              </button>
              <button
                onClick={() => { setIsScanning(!isScanning); setIsAdding(false); setScanResult(null); setScanError(""); setScanSaved(false); setShowNewBiller(false); setNewBillerName(""); }}
                title="Scan PDF"
                className={`flex items-center gap-2 px-3 py-2 rounded-xl font-semibold border transition-all ${
                  isScanning
                    ? "bg-violet-600/20 border-violet-500/40 text-violet-300"
                    : "bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                }`}
              >
                <FileScan className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">Scan PDF</span>
              </button>
              <button
                onClick={() => { setIsAdding(!isAdding); setIsScanning(false); setEditForm(null); }}
                className="flex items-center gap-2 px-3 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold shadow-lg shadow-primary/25 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">Add Bill</span>
              </button>
            </>
          )}
          <div className="flex items-center gap-1 bg-card border border-white/10 rounded-xl p-1">
            <button
              onClick={() => { setView("bills"); setIsAdding(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                view === "bills" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-white hover:bg-white/5"
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Bills</span>
            </button>
            <button
              onClick={() => { setView("history"); setIsAdding(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                view === "history" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-white hover:bg-white/5"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">History</span>
            </button>
          </div>
        </div>
      </div>

      {/* Auto-fill success banner */}
      {autoFillBanner && (
        <div className="flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl animate-in fade-in slide-in-from-top-2">
          <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-300">
              {autoFillBanner.count} upcoming bill{autoFillBanner.count !== 1 ? "s" : ""} auto-generated
            </p>
            <p className="text-xs text-emerald-400/70 mt-0.5">
              Added the next 3 months for: {autoFillBanner.names.join(", ")}
            </p>
          </div>
          <button onClick={() => setAutoFillBanner(null)} className="text-emerald-400/60 hover:text-emerald-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add Bill Form */}
      {isAdding && (
        <form
          onSubmit={handleAddSubmit}
          className="glass-panel p-6 rounded-2xl border border-primary/20 space-y-4 animate-in fade-in slide-in-from-top-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" /> Add New Bill
            </h3>
            <button type="button" onClick={() => setIsAdding(false)} className="text-muted-foreground hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1 sm:col-span-2 lg:col-span-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Biller *</label>
              <select
                name="billerId"
                required
                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
              >
                <option value="">Select biller…</option>
                {billers?.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount Due *</label>
              <input
                name="amountDue"
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0.00"
                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Due Date *</label>
              <input
                name="dueDate"
                type="date"
                required
                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</label>
              <select
                name="status"
                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
              >
                <option value="unpaid">Unpaid</option>
                <option value="scheduled">Scheduled</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-white hover:bg-white/5 rounded-lg transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-primary hover:bg-primary/90 text-white rounded-lg shadow-lg shadow-primary/25 transition-all disabled:opacity-50"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {createMutation.isPending ? "Saving…" : "Save Bill"}
            </button>
          </div>
        </form>
      )}

      {/* PDF Scanner Panel */}
      {isScanning && (
        <div className="glass-panel p-6 rounded-2xl border border-violet-500/20 space-y-4 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <FileScan className="w-4 h-4 text-violet-400" /> Scan PDF Bill
            </h3>
            <button onClick={() => setIsScanning(false)} className="text-muted-foreground hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div
            className="border-2 border-dashed border-white/10 hover:border-violet-500/40 rounded-xl p-8 text-center cursor-pointer transition-colors group"
            onClick={() => scanFileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleScanFile(f); }}
          >
            <input
              ref={scanFileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleScanFile(f); if (e.target) e.target.value = ""; }}
            />
            {scanning ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-10 h-10 text-violet-400 animate-spin" />
                <p className="text-sm text-white font-medium">Reading PDF…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-10 h-10 text-muted-foreground/50 group-hover:text-violet-400/70 transition-colors" />
                <p className="text-sm font-medium text-white">Drop your PDF bill here or click to browse</p>
                <p className="text-xs text-muted-foreground">Text-based PDFs only · Max 10 MB</p>
              </div>
            )}
          </div>

          {scanError && (
            <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-sm text-rose-300">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {scanError}
            </div>
          )}

          {scanResult && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                  scanResult.confidence === "high" ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" :
                  scanResult.confidence === "partial" ? "text-amber-300 bg-amber-500/10 border-amber-500/20" :
                  "text-rose-300 bg-rose-500/10 border-rose-500/20"
                }`}>
                  {scanResult.confidence === "high" ? "✓ High confidence" : scanResult.confidence === "partial" ? "⚠ Partial match" : "Low confidence"}
                </span>
                <span className="text-xs text-muted-foreground">{scanResult.pages} page{scanResult.pages !== 1 ? "s" : ""}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">Amount Due</p>
                  <p className="text-2xl font-display font-bold text-white">
                    {scanResult.amountDue !== null ? formatCurrency(scanResult.amountDue) : <span className="text-muted-foreground text-base">Not found</span>}
                  </p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">Due Date</p>
                  <p className="text-xl font-bold text-white">
                    {scanResult.dueDate || <span className="text-muted-foreground text-base">Not found</span>}
                  </p>
                </div>
              </div>

              {scanResult.amountDue && scanResult.dueDate && !scanSaved && (
                <div className="space-y-3 p-4 bg-white/3 border border-white/10 rounded-xl">
                  <div className="flex items-center gap-3">
                    <select
                      value={scanBillerId}
                      onChange={e => { setScanBillerId(e.target.value); setShowNewBiller(false); }}
                      className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary outline-none"
                    >
                      <option value="">Select a biller…</option>
                      {billers?.map((b: any) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleScanSave}
                      disabled={!scanBillerId || createMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-primary/25 shrink-0"
                    >
                      {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Add to Bills
                    </button>
                  </div>

                  {/* Quick-create biller */}
                  {!showNewBiller ? (
                    <button
                      onClick={() => setShowNewBiller(true)}
                      className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Biller not in the list? Create one
                    </button>
                  ) : (
                    <div className="space-y-2 pt-1 border-t border-white/10">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Biller</p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          placeholder="Biller name…"
                          value={newBillerName}
                          onChange={e => setNewBillerName(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") handleCreateScanBiller(); if (e.key === "Escape") setShowNewBiller(false); }}
                          autoFocus
                          className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-violet-500 outline-none placeholder:text-muted-foreground/50"
                        />
                        <select
                          value={newBillerCategory}
                          onChange={e => setNewBillerCategory(e.target.value)}
                          className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-violet-500 outline-none"
                        >
                          {["Housing","Utilities","Entertainment","Subscriptions","Insurance","Health","Food","Transport"].map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleCreateScanBiller}
                          disabled={!newBillerName.trim() || createBillerMutation.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-all disabled:opacity-50"
                        >
                          {createBillerMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                          Create &amp; Select
                        </button>
                        <button
                          onClick={() => setShowNewBiller(false)}
                          className="text-xs text-muted-foreground hover:text-white transition-colors px-2 py-1.5"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {scanSaved && (
                <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-sm text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> Bill added! Upload another PDF or close this panel.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {view === "bills" && (
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="flex items-center gap-1 bg-card border border-white/10 rounded-xl p-1 w-max min-w-full sm:w-fit sm:min-w-0">
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  filter === f
                    ? "bg-primary/80 text-white shadow-md"
                    : "text-muted-foreground hover:text-white hover:bg-white/5"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-white/5 rounded-2xl animate-pulse" />)}
        </div>
      ) : view === "history" ? (
        <HistoryView bills={paidBills} />
      ) : (
        <BillsList
          bills={filteredBills}
          justPaidIds={justPaidIds}
          confirmDialog={confirmDialog}
          editForm={editForm}
          onMarkPaid={handleMarkPaidClick}
          onConfirmPaid={handleConfirmPaid}
          onCancelDialog={() => setConfirmDialog(null)}
          onConfirmDialogChange={(val) =>
            setConfirmDialog(prev => prev ? { ...prev, confirmationNumber: val } : null)
          }
          onEdit={(bill) => setEditForm({
            billId: bill.id,
            amountDue: bill.amountDue,
            dueDate: bill.dueDate,
            status: bill.status,
          })}
          onEditChange={(field, val) =>
            setEditForm(prev => prev ? { ...prev, [field]: val } : null)
          }
          onEditSubmit={handleEditSubmit}
          onEditCancel={() => setEditForm(null)}
          onDelete={handleDelete}
          onPay={(id) => setPayingBillId(id)}
          isPending={updateMutation.isPending || deleteMutation.isPending}
        />
      )}

      {payingBillId !== null && (
        <PayBillModal
          billInstanceId={payingBillId}
          onSuccess={() => {
            invalidate();
            setPayingBillId(null);
          }}
          onClose={() => setPayingBillId(null)}
        />
      )}
    </div>
  );
}

function BillsList({
  bills,
  justPaidIds,
  confirmDialog,
  editForm,
  onMarkPaid,
  onConfirmPaid,
  onCancelDialog,
  onConfirmDialogChange,
  onEdit,
  onEditChange,
  onEditSubmit,
  onEditCancel,
  onDelete,
  onPay,
  isPending,
}: {
  bills: any[];
  justPaidIds: Set<number>;
  confirmDialog: ConfirmDialog | null;
  editForm: EditForm | null;
  onMarkPaid: (id: number) => void;
  onConfirmPaid: (skip?: boolean) => void;
  onCancelDialog: () => void;
  onConfirmDialogChange: (val: string) => void;
  onEdit: (bill: any) => void;
  onEditChange: (field: string, val: string) => void;
  onEditSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onEditCancel: () => void;
  onDelete: (id: number) => void;
  onPay: (id: number) => void;
  isPending: boolean;
}) {
  if (bills.length === 0) {
    return (
      <div className="p-12 text-center glass-panel rounded-2xl">
        <CalendarDays className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-lg text-white font-medium">No bills found</p>
        <p className="text-muted-foreground text-sm">Try a different filter, or add a new bill with the button above.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {bills.map((bill) => {
        const isJustPaid = justPaidIds.has(bill.id);
        const isConfirming = confirmDialog?.billId === bill.id;
        const isEditing = editForm?.billId === bill.id;

        return (
          <div key={bill.id} className="space-y-0">
            {/* Main row */}
            <div
              className={`glass-panel p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 group transition-all duration-500 ${
                isJustPaid ? "border-emerald-500/40 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.1)]" : ""
              } ${isConfirming || isEditing ? "rounded-b-none border-b-0" : ""}`}
            >
              <div className="flex items-center gap-4">
                <BillerIcon icon={bill.biller?.icon} category={bill.biller?.category} name={bill.biller?.name ?? ""} size="lg" />
                <div>
                  <h3 className="font-bold text-lg text-white group-hover:text-primary transition-colors">
                    {bill.biller?.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {bill.biller?.category} • Due {format(parseISO(bill.dueDate), 'MMMM d, yyyy')}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 sm:w-auto">
                <div className="text-left sm:text-right">
                  <p className="font-display font-bold text-2xl text-white">{formatCurrency(bill.amountDue)}</p>
                  <StatusBadge status={isJustPaid ? "paid" : bill.status} className="mt-1 inline-block" />
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Edit button */}
                  {!isEditing && !isConfirming && (
                    <button
                      onClick={() => onEdit(bill)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/8 opacity-0 group-hover:opacity-100 transition-all"
                      title="Edit bill"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Delete button */}
                  {!isEditing && !isConfirming && (
                    <button
                      onClick={() => onDelete(bill.id)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white/30 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete bill"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Pay with card button */}
                  {bill.status !== 'paid' && !isConfirming && !isEditing && (
                    <button
                      onClick={() => onPay(bill.id)}
                      className="shrink-0 flex items-center gap-1.5 px-3 h-9 rounded-xl bg-primary/10 hover:bg-primary/25 text-primary border border-primary/20 hover:border-primary/40 text-xs font-semibold transition-all opacity-0 group-hover:opacity-100"
                      title="Pay with card"
                    >
                      <CreditCard className="w-3.5 h-3.5" /> Pay
                    </button>
                  )}

                  {/* Mark paid button */}
                  {bill.status !== 'paid' && !isConfirming && !isEditing && (
                    <button
                      onClick={() => !isJustPaid && onMarkPaid(bill.id)}
                      disabled={isPending && !isJustPaid}
                      className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 ${
                        isJustPaid
                          ? "bg-emerald-500 text-white scale-110 shadow-[0_0_20px_rgba(16,185,129,0.5)]"
                          : "bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 hover:scale-105 active:scale-95"
                      }`}
                      title="Mark as Paid (manual)"
                    >
                      {isJustPaid
                        ? <Check className="w-5 h-5 animate-in zoom-in duration-200" strokeWidth={3} />
                        : <CheckCircle2 className="w-5 h-5" />
                      }
                    </button>
                  )}

                  {bill.status === 'paid' && !isEditing && (
                    <div className="shrink-0 w-11 h-11 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                      <Check className="w-5 h-5" strokeWidth={2.5} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Confirmation number panel */}
            {isConfirming && (
              <div className="glass-panel rounded-t-none rounded-b-2xl border-t border-white/5 px-5 py-4 bg-emerald-500/5 border-emerald-500/20 animate-in slide-in-from-top-2 duration-200">
                <p className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Hash className="w-4 h-4 text-emerald-400" />
                  Add Confirmation Number <span className="text-muted-foreground font-normal">(optional)</span>
                </p>
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    type="text"
                    placeholder="e.g. TXN-8472930"
                    value={confirmDialog?.confirmationNumber || ""}
                    onChange={e => onConfirmDialogChange(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") onConfirmPaid(); if (e.key === "Escape") onCancelDialog(); }}
                    className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30 focus:border-emerald-500/50 outline-none transition-colors"
                  />
                  <button onClick={() => onConfirmPaid(true)} className="px-3 py-2 text-sm text-muted-foreground hover:text-white hover:bg-white/5 rounded-lg transition-all">Skip</button>
                  <button onClick={() => onConfirmPaid()} className="px-4 py-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg transition-all shadow-lg shadow-emerald-500/25">Mark Paid</button>
                  <button onClick={onCancelDialog} className="p-2 text-muted-foreground hover:text-white transition-colors"><X className="w-4 h-4" /></button>
                </div>
              </div>
            )}

            {/* Inline edit panel */}
            {isEditing && editForm && (
              <form
                onSubmit={onEditSubmit}
                className="glass-panel rounded-t-none rounded-b-2xl border-t border-white/5 px-5 py-4 bg-primary/3 border-primary/20 animate-in slide-in-from-top-2 duration-200"
              >
                <p className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Pencil className="w-3.5 h-3.5 text-primary" /> Edit Bill
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Amount Due</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editForm.amountDue}
                      onChange={e => onEditChange("amountDue", e.target.value)}
                      className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary/50 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Due Date</label>
                    <input
                      type="date"
                      value={editForm.dueDate}
                      onChange={e => onEditChange("dueDate", e.target.value)}
                      className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary/50 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Status</label>
                    <select
                      value={editForm.status}
                      onChange={e => onEditChange("status", e.target.value)}
                      className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary/50 outline-none"
                    >
                      {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <button type="button" onClick={onEditCancel} className="px-3 py-1.5 text-sm text-muted-foreground hover:text-white hover:bg-white/5 rounded-lg transition-all">Cancel</button>
                  <button type="submit" disabled={isPending} className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold bg-primary hover:bg-primary/90 text-white rounded-lg transition-all disabled:opacity-50">
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Save Changes
                  </button>
                </div>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HistoryView({ bills }: { bills: any[] }) {
  if (bills.length === 0) {
    return (
      <div className="p-12 text-center glass-panel rounded-2xl">
        <History className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-lg text-white font-medium">No payment history yet</p>
        <p className="text-muted-foreground text-sm">Bills you mark as paid will appear here.</p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10 text-left">
            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Biller</th>
            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Due Date</th>
            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Paid On</th>
            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Amount</th>
            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Confirmation #</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {bills.map(bill => (
            <tr key={bill.id} className="hover:bg-white/3 transition-colors group">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <BillerIcon icon={bill.biller?.icon} category={bill.biller?.category} name={bill.biller?.name ?? ""} size="sm" />
                  <div>
                    <p className="font-semibold text-white text-sm">{bill.biller?.name}</p>
                    <p className="text-xs text-muted-foreground">{bill.biller?.category}</p>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-sm text-muted-foreground hidden sm:table-cell">
                {format(parseISO(bill.dueDate), 'MMM d, yyyy')}
              </td>
              <td className="px-6 py-4 text-sm text-emerald-400">
                {bill.paidAt
                  ? format(new Date(bill.paidAt), 'MMM d, yyyy')
                  : <span className="text-muted-foreground">—</span>}
              </td>
              <td className="px-6 py-4 text-right">
                <span className="font-display font-bold text-white">{formatCurrency(bill.amountDue)}</span>
              </td>
              <td className="px-6 py-4 hidden md:table-cell">
                {bill.confirmationNumber ? (
                  <span className="font-mono text-xs bg-white/5 border border-white/10 px-2 py-1 rounded text-white/80">
                    {bill.confirmationNumber}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-sm">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-6 py-3 border-t border-white/10 flex justify-between items-center">
        <p className="text-xs text-muted-foreground">{bills.length} payment{bills.length !== 1 ? "s" : ""} recorded</p>
        <p className="text-sm font-semibold text-white">
          Total: {formatCurrency(bills.reduce((sum, b) => sum + parseFloat(b.amountDue || "0"), 0))}
        </p>
      </div>
    </div>
  );
}
