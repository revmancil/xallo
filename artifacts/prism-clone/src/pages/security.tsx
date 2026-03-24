import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Shield, Key, FileText, Upload, CheckCircle2, AlertTriangle,
  Loader2, Smartphone, LogIn, DollarSign, Link2, Lock,
  Eye, EyeOff, X, FileScan
} from "lucide-react";
import { formatCurrency, toNumber } from "@/lib/utils";
import { useGetBillers, useCreateBillInstance } from "@workspace/api-client-react";
import { getGetBillInstancesQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";

const API_BASE = import.meta.env.BASE_URL + "api";

function useSecurityLogs() {
  return useQuery({
    queryKey: ["security", "logs"],
    queryFn: () => fetch(`${API_BASE}/security/logs`).then(r => r.json()),
  });
}

function use2FAStatus() {
  return useQuery({
    queryKey: ["security", "2fa"],
    queryFn: () => fetch(`${API_BASE}/security/2fa/status`).then(r => r.json()),
  });
}

const ACTION_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  login: { label: "Login", icon: <LogIn className="w-3.5 h-3.5" />, color: "text-blue-400" },
  logout: { label: "Logout", icon: <LogIn className="w-3.5 h-3.5" />, color: "text-muted-foreground" },
  bill_paid: { label: "Bill Marked Paid", icon: <DollarSign className="w-3.5 h-3.5" />, color: "text-emerald-400" },
  plaid_linked: { label: "Bank Account Linked", icon: <Link2 className="w-3.5 h-3.5" />, color: "text-blue-400" },
  pdf_bill_parsed: { label: "PDF Bill Scanned", icon: <FileScan className="w-3.5 h-3.5" />, color: "text-violet-400" },
  "2fa_enabled": { label: "2FA Enabled", icon: <Shield className="w-3.5 h-3.5" />, color: "text-emerald-400" },
  "2fa_disabled": { label: "2FA Disabled", icon: <Shield className="w-3.5 h-3.5" />, color: "text-amber-400" },
};

function AuditLog() {
  const { data: logs, isLoading } = useSecurityLogs();

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-12 bg-white/5 rounded-xl animate-pulse" />)}
          </div>
        ) : !logs?.length ? (
          <div className="p-12 text-center">
            <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-lg font-bold text-white">No events yet</p>
            <p className="text-sm text-muted-foreground">Security events will appear here as you use the app.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Event</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Timestamp</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">IP Address</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {logs.map((log: any) => {
                const info = ACTION_LABELS[log.action] || { label: log.action, icon: <Eye className="w-3.5 h-3.5" />, color: "text-muted-foreground" };
                return (
                  <tr key={log.id} className="hover:bg-white/3 transition-colors">
                    <td className="px-6 py-4">
                      <div className={`flex items-center gap-2 text-sm font-medium ${info.color}`}>
                        {info.icon}
                        {info.label}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground hidden md:table-cell">
                      {format(new Date(log.createdAt), "MMM d, yyyy h:mm a")}
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <span className="font-mono text-xs bg-white/5 border border-white/10 px-2 py-1 rounded text-white/60">
                        {log.ipAddress || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground hidden lg:table-cell">
                      {log.metadata ? (
                        <span className="truncate max-w-[180px] block">
                          {Object.entries(log.metadata)
                            .filter(([, v]) => v !== null && v !== undefined)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(", ")}
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function TwoFactorAuth() {
  const queryClient = useQueryClient();
  const { data: status, isLoading } = use2FAStatus();
  const [step, setStep] = useState<"idle" | "setup" | "verify" | "done">("idle");
  const [qrData, setQrData] = useState<{ qrCodeUrl: string; manualKey: string } | null>(null);
  const [token, setToken] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState("");
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [loadingVerify, setLoadingVerify] = useState(false);

  const handleSetup = async () => {
    setLoadingSetup(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/security/2fa/setup`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQrData(data);
      setStep("setup");
    } catch (e: any) {
      setError(e.message || "Failed to set up 2FA.");
    } finally {
      setLoadingSetup(false);
    }
  };

  const handleVerify = async () => {
    setLoadingVerify(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/security/2fa/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStep("done");
      queryClient.invalidateQueries({ queryKey: ["security", "2fa"] });
      queryClient.invalidateQueries({ queryKey: ["security", "logs"] });
    } catch (e: any) {
      setError(e.message || "Verification failed.");
    } finally {
      setLoadingVerify(false);
    }
  };

  const handleDisable = async () => {
    await fetch(`${API_BASE}/security/2fa/disable`, { method: "POST" });
    queryClient.invalidateQueries({ queryKey: ["security", "2fa"] });
    queryClient.invalidateQueries({ queryKey: ["security", "logs"] });
    setStep("idle");
  };

  if (isLoading) return <div className="h-40 bg-white/5 rounded-2xl animate-pulse" />;

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400 shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white">Two-Factor Authentication</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Use Google Authenticator or any TOTP app for an extra layer of security.
                </p>
              </div>
              <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${
                status?.enabled
                  ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
                  : "text-muted-foreground bg-white/5 border-white/10"
              }`}>
                {status?.enabled ? <><CheckCircle2 className="w-3.5 h-3.5" /> Enabled</> : <><Lock className="w-3.5 h-3.5" /> Disabled</>}
              </div>
            </div>

            {error && (
              <div className="mt-4 flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-sm text-rose-300">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            {(step === "idle" || step === "done") && (
              <div className="mt-4 flex gap-3">
                {status?.enabled ? (
                  <button
                    onClick={handleDisable}
                    className="px-4 py-2 text-sm font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 rounded-xl transition-all"
                  >
                    Disable 2FA
                  </button>
                ) : (
                  <button
                    onClick={handleSetup}
                    disabled={loadingSetup}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl shadow-lg shadow-violet-500/20 transition-all disabled:opacity-50"
                  >
                    {loadingSetup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                    {loadingSetup ? "Setting up…" : "Enable 2FA"}
                  </button>
                )}
              </div>
            )}

            {step === "setup" && qrData && (
              <div className="mt-5 space-y-4">
                <p className="text-sm text-white font-medium">
                  Scan this QR code with Google Authenticator, Authy, or any TOTP app:
                </p>
                <div className="flex flex-col sm:flex-row gap-6 items-start">
                  <img src={qrData.qrCodeUrl} alt="2FA QR Code" className="w-40 h-40 rounded-xl bg-white p-2" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-2">Can't scan? Enter this key manually:</p>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-xs bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white/80 break-all">
                        {showKey ? qrData.manualKey : "••••••••••••••••••••••••••••••••"}
                      </code>
                      <button onClick={() => setShowKey(!showKey)} className="text-muted-foreground hover:text-white">
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 mb-2">Then enter the 6-digit code from your app:</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="000000"
                        value={token}
                        onChange={e => setToken(e.target.value.replace(/\D/g, ""))}
                        onKeyDown={e => { if (e.key === "Enter" && token.length === 6) handleVerify(); }}
                        className="w-32 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-center tracking-widest focus:border-violet-500/50 outline-none"
                      />
                      <button
                        onClick={handleVerify}
                        disabled={token.length !== 6 || loadingVerify}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg shadow-lg transition-all disabled:opacity-50"
                      >
                        {loadingVerify ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
                      </button>
                      <button onClick={() => setStep("idle")} className="p-2 text-muted-foreground hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white">Data Encryption</h3>
            <p className="text-sm text-muted-foreground">All sensitive tokens are encrypted at rest using AES-256-GCM.</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" /> Active
          </div>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Set <code className="bg-black/20 px-1 rounded">ENCRYPTION_KEY</code> in your environment variables (32+ characters) for production-grade encryption. Without it, a development key is used. Plaid access tokens and 2FA secrets are always encrypted before storage.
        </p>
      </div>
    </div>
  );
}

function BillScanner() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: billers } = useGetBillers();
  const [result, setResult] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [billerId, setBillerId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const createBill = useCreateBillInstance({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBillInstancesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        setSaved(true);
        setSaving(false);
      }
    }
  });

  const handleFile = async (file: File) => {
    setUploading(true);
    setError("");
    setResult(null);
    setSaved(false);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`${API_BASE}/pdf/parse`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (e: any) {
      setError(e.message || "Failed to parse PDF.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    if (!result?.amountDue || !result?.dueDate || !billerId) return;
    setSaving(true);
    createBill.mutate({
      data: { billerId: parseInt(billerId), amountDue: result.amountDue, dueDate: result.dueDate, status: "unpaid" }
    });
  };

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400 shrink-0">
            <FileScan className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white">PDF Bill Scanner</h3>
            <p className="text-sm text-muted-foreground">
              Upload a PDF bill to automatically extract the amount due and due date.
            </p>
          </div>
        </div>

        <div
          className="border-2 border-dashed border-white/10 hover:border-primary/40 rounded-xl p-8 text-center cursor-pointer transition-colors group"
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); }}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <p className="text-sm text-white font-medium">Scanning PDF…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-10 h-10 text-muted-foreground/50 group-hover:text-primary/60 transition-colors" />
              <p className="text-sm font-medium text-white">Drop your PDF bill here or click to browse</p>
              <p className="text-xs text-muted-foreground">Text-based PDFs only (not scanned images) · Max 10MB</p>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-sm text-rose-300">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {result && (
          <div className="mt-5 space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center gap-2">
              <div className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                result.confidence === "high" ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" :
                result.confidence === "partial" ? "text-amber-300 bg-amber-500/10 border-amber-500/20" :
                "text-rose-300 bg-rose-500/10 border-rose-500/20"
              }`}>
                {result.confidence === "high" ? "✓ High Confidence" : result.confidence === "partial" ? "⚠ Partial Match" : "Low Confidence"}
              </div>
              <span className="text-xs text-muted-foreground">{result.pages} page{result.pages !== 1 ? "s" : ""} scanned</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="glass-panel rounded-xl p-4 border border-white/5">
                <p className="text-xs text-muted-foreground mb-1">Amount Due</p>
                <p className="text-2xl font-display font-bold text-white">
                  {result.amountDue !== null ? formatCurrency(result.amountDue) : <span className="text-muted-foreground text-base">Not found</span>}
                </p>
              </div>
              <div className="glass-panel rounded-xl p-4 border border-white/5">
                <p className="text-xs text-muted-foreground mb-1">Due Date</p>
                <p className="text-xl font-bold text-white">
                  {result.dueDate || <span className="text-muted-foreground text-base">Not found</span>}
                </p>
              </div>
            </div>

            {result.amountDue && result.dueDate && !saved && (
              <div className="flex items-center gap-3 p-4 bg-white/3 border border-white/10 rounded-xl">
                <select
                  value={billerId}
                  onChange={e => setBillerId(e.target.value)}
                  className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary outline-none"
                >
                  <option value="">Select a biller…</option>
                  {billers?.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleSave}
                  disabled={!billerId || saving}
                  className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-primary/25"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Add to Bills
                </button>
              </div>
            )}

            {saved && (
              <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-sm text-emerald-300">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Bill added to your calendar successfully!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Security() {
  const [tab, setTab] = useState<"audit" | "2fa" | "scanner">("audit");

  const tabs = [
    { id: "audit", label: "Audit Log", icon: <Eye className="w-3.5 h-3.5" /> },
    { id: "2fa", label: "Two-Factor Auth", icon: <Key className="w-3.5 h-3.5" /> },
    { id: "scanner", label: "Bill Scanner", icon: <FileScan className="w-3.5 h-3.5" /> },
  ] as const;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-gradient mb-2">Security</h1>
          <p className="text-muted-foreground">Audit log, two-factor authentication, and PDF bill scanning.</p>
        </div>

        <div className="overflow-x-auto -mx-1 px-1">
          <div className="flex items-center gap-1 bg-card border border-white/10 rounded-xl p-1 w-max">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  tab === t.id ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:text-white hover:bg-white/5"
                }`}
              >
                {t.icon}
                <span className="hidden xs:inline">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === "audit" && <AuditLog />}
      {tab === "2fa" && <TwoFactorAuth />}
      {tab === "scanner" && <BillScanner />}
    </div>
  );
}
