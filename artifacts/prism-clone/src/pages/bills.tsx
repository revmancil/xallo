import { useState } from "react";
import {
  useGetBillInstances,
  useUpdateBillInstance,
  useCreateBillInstance,
  useDeleteBillInstance,
  useGetBillers,
  getGetBillInstancesQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import { BillerIcon } from "@/components/biller-icon";
import { format, parseISO } from "date-fns";
import {
  CheckCircle2, Check, History, Hash, X, Plus,
  Pencil, Trash2, Loader2, CalendarDays,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

type ConfirmDialog = { billId: number; confirmationNumber: string };
type EditForm = { billId: number; amountDue: string; dueDate: string; status: string };

const STATUS_OPTIONS = ["unpaid", "scheduled", "paid", "overdue"];

export default function Bills() {
  const [filter, setFilter] = useState<string>("all");
  const [view, setView] = useState<"bills" | "history">("bills");
  const [justPaidIds, setJustPaidIds] = useState<Set<number>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const { data: bills, isLoading } = useGetBillInstances();
  const { data: billers } = useGetBillers();
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetBillInstancesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const updateMutation = useUpdateBillInstance({ mutation: { onSuccess: invalidate } });
  const createMutation = useCreateBillInstance({ mutation: { onSuccess: () => { invalidate(); setIsAdding(false); } } });
  const deleteMutation = useDeleteBillInstance({ mutation: { onSuccess: invalidate } });

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

        <div className="flex items-center gap-2">
          {view === "bills" && (
            <button
              onClick={() => { setIsAdding(!isAdding); setEditForm(null); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold shadow-lg shadow-primary/25 transition-all"
            >
              <Plus className="w-4 h-4" /> Add Bill
            </button>
          )}
          <div className="flex items-center gap-1 bg-card border border-white/10 rounded-xl p-1">
            <button
              onClick={() => { setView("bills"); setIsAdding(false); }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                view === "bills" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-white hover:bg-white/5"
              }`}
            >
              Bills
            </button>
            <button
              onClick={() => { setView("history"); setIsAdding(false); }}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                view === "history" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-white hover:bg-white/5"
              }`}
            >
              <History className="w-3.5 h-3.5" /> History
            </button>
          </div>
        </div>
      </div>

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

      {view === "bills" && (
        <div className="flex items-center gap-2 bg-card border border-white/10 rounded-xl p-1 w-fit">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filter === f
                  ? "bg-primary/80 text-white shadow-md"
                  : "text-muted-foreground hover:text-white hover:bg-white/5"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
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
          isPending={updateMutation.isPending || deleteMutation.isPending}
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
                      title="Mark as Paid"
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
