import { useGetDashboardSummary } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import { Wallet, TrendingUp, AlertTriangle, ArrowRight, ShieldCheck, CreditCard } from "lucide-react";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";

export default function Dashboard() {
  const { data: summary, isLoading, isError } = useGetDashboardSummary();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !summary) {
    return (
      <div className="glass-panel p-8 rounded-2xl text-center">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Could not load dashboard</h2>
        <p className="text-muted-foreground">The API might be starting up or seed data is missing.</p>
      </div>
    );
  }

  const isGapPositive = summary.safetyGap >= 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-display font-bold text-gradient mb-2">Overview</h1>
        <p className="text-muted-foreground">Here's your cash flow snapshot for the next 30 days.</p>
      </div>

      {/* Top Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Wallet className="w-16 h-16" />
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-1">Available Cash</p>
          <h2 className="text-3xl font-bold text-white tracking-tight">{formatCurrency(summary.totalBalance)}</h2>
        </div>

        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-rose-500">
            <CreditCard className="w-16 h-16" />
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-1 flex justify-between">
            Upcoming Bills
            {summary.overdueCount > 0 && (
              <span className="text-xs text-rose-500 font-bold bg-rose-500/10 px-2 rounded-full flex items-center">
                {summary.overdueCount} Overdue
              </span>
            )}
          </p>
          <h2 className="text-3xl font-bold text-white tracking-tight">{formatCurrency(summary.totalBillsDue30Days)}</h2>
        </div>

        <div className={`p-6 rounded-2xl border relative overflow-hidden transition-all duration-500 ${
          isGapPositive 
            ? "bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.15)]" 
            : "bg-rose-500/10 border-rose-500/30 shadow-[0_0_30px_rgba(244,63,94,0.15)]"
        }`}>
          <div className="absolute top-0 right-0 p-4 opacity-20">
            {isGapPositive ? <ShieldCheck className="w-16 h-16 text-emerald-500" /> : <AlertTriangle className="w-16 h-16 text-rose-500" />}
          </div>
          <p className={`text-sm font-medium mb-1 ${isGapPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            Safety Gap
          </p>
          <h2 className={`text-3xl font-bold tracking-tight ${isGapPositive ? 'text-emerald-400' : 'text-rose-500'}`}>
            {formatCurrency(summary.safetyGap)}
          </h2>
        </div>
      </div>

      {/* Upcoming Bills List */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-xl font-display font-semibold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Bills Due Next 30 Days
          </h3>
          <Link href="/bills" className="text-sm text-primary hover:text-blue-400 flex items-center gap-1 font-medium group">
            View All
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
        
        <div className="divide-y divide-white/5">
          {summary.upcomingBills.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <div className="w-16 h-16 mx-auto mb-4 bg-white/5 rounded-full flex items-center justify-center">
                <ShieldCheck className="w-8 h-8 text-emerald-500" />
              </div>
              <p className="font-medium text-white mb-1">You're all caught up!</p>
              <p className="text-sm">No bills due in the next 30 days.</p>
            </div>
          ) : (
            summary.upcomingBills.map((bill) => (
              <div key={bill.id} className="p-4 hover:bg-white/[0.02] transition-colors flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border border-white/10 flex items-center justify-center shadow-inner text-xl font-bold text-white/80">
                    {bill.biller?.icon || bill.biller?.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-white group-hover:text-primary transition-colors">{bill.biller?.name}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      Due {format(parseISO(bill.dueDate), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg text-white mb-1">{formatCurrency(bill.amountDue)}</p>
                  <StatusBadge status={bill.status} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
