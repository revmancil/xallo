import { useGetDashboardSummary, useGetIncomeEntries } from "@workspace/api-client-react";
import { formatCurrency, toNumber } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import { BillerIcon } from "@/components/biller-icon";
import {
  Wallet, TrendingUp, AlertTriangle, ArrowRight, ShieldCheck,
  CreditCard, Banknote, CalendarDays,
} from "lucide-react";
import { Link } from "wouter";
import { format, parseISO, isAfter, isBefore, startOfDay } from "date-fns";
import { useMemo } from "react";

export default function Dashboard() {
  const { data: summary, isLoading, isError } = useGetDashboardSummary();
  const { data: incomeEntries = [] } = useGetIncomeEntries();

  const projection = useMemo(() => {
    if (!summary) return null;
    const today = startOfDay(new Date());
    const currentBalance = toNumber(summary.totalBalance);

    const upcomingIncome = incomeEntries
      .map(inc => ({ date: parseISO(inc.payDate), amount: toNumber(inc.amount), label: inc.label }))
      .filter(inc => !isBefore(inc.date, today))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const nextPaycheck = upcomingIncome.find(inc => isAfter(inc.date, today));

    const billsBeforeNextPaycheck = nextPaycheck
      ? summary.upcomingBills.filter(b =>
          b.status !== 'paid' &&
          isBefore(parseISO(b.dueDate), nextPaycheck.date)
        )
      : summary.upcomingBills.filter(b => b.status !== 'paid');

    const totalBeforePaycheck = billsBeforeNextPaycheck.reduce(
      (s, b) => s + toNumber(b.amountDue), 0
    );
    const safeToSpend = currentBalance - totalBeforePaycheck;

    const allEvents: Array<{
      date: Date;
      type: 'bill' | 'income';
      label: string;
      amount: number;
      runningBalance?: number;
      isWarning?: boolean;
      billStatus?: string;
    }> = [
      ...summary.upcomingBills
        .filter(b => b.status !== 'paid')
        .map(b => ({
          date: parseISO(b.dueDate),
          type: 'bill' as const,
          label: b.biller?.name ?? 'Bill',
          amount: -toNumber(b.amountDue),
          billStatus: b.status,
        })),
      ...upcomingIncome.slice(0, 3).map(inc => ({
        date: inc.date,
        type: 'income' as const,
        label: inc.label,
        amount: inc.amount,
      })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 8);

    let running = currentBalance;
    for (const event of allEvents) {
      running += event.amount;
      event.runningBalance = running;
      event.isWarning = running < 0;
    }

    return { safeToSpend, nextPaycheck, billsBeforeNextPaycheck, totalBeforePaycheck, allEvents };
  }, [summary, incomeEntries]);

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

  const isGapPositive = toNumber(summary.safetyGap) >= 0;
  const isSafePositive = (projection?.safeToSpend ?? 0) >= 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-display font-bold text-gradient mb-2">Overview</h1>
        <p className="text-muted-foreground">Here's your cash flow snapshot for the next 30 days.</p>
      </div>

      {/* Top Stats */}
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
            Upcoming Bills (30d)
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
            Safety Gap (30d)
          </p>
          <h2 className={`text-3xl font-bold tracking-tight ${isGapPositive ? 'text-emerald-400' : 'text-rose-500'}`}>
            {formatCurrency(summary.safetyGap)}
          </h2>
        </div>
      </div>

      {/* Cash Flow Projection */}
      {projection && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Safe to Spend */}
          <div className="lg:col-span-2 space-y-4">
            <div className={`p-6 rounded-2xl border relative overflow-hidden ${
              isSafePositive
                ? "bg-emerald-500/5 border-emerald-500/20"
                : "bg-rose-500/5 border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.1)]"
            }`}>
              <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${isSafePositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                Safe to Spend
              </p>
              <h3 className={`text-4xl font-bold mb-1 ${isSafePositive ? 'text-white' : 'text-rose-400'}`}>
                {formatCurrency(projection.safeToSpend)}
              </h3>
              <p className="text-xs text-muted-foreground">
                After paying {projection.billsBeforeNextPaycheck.length} bill{projection.billsBeforeNextPaycheck.length !== 1 ? 's' : ''}
                {projection.nextPaycheck ? ` before ${format(projection.nextPaycheck.date, 'MMM d')}` : ' due soon'}
              </p>

              {!isSafePositive && (
                <div className="mt-3 flex items-center gap-2 text-rose-400 text-xs font-medium bg-rose-500/10 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Your bills exceed your balance before next payday
                </div>
              )}
            </div>

            {projection.nextPaycheck && (
              <div className="glass-panel p-4 rounded-xl flex items-center gap-3 border border-emerald-500/10">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                  <Banknote className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Next Payday</p>
                  <p className="font-semibold text-white truncate">{projection.nextPaycheck.label}</p>
                  <p className="text-xs text-emerald-400">{format(projection.nextPaycheck.date, 'EEEE, MMM d')}</p>
                </div>
                <p className="font-bold text-emerald-400">{formatCurrency(projection.nextPaycheck.amount)}</p>
              </div>
            )}

            {projection.billsBeforeNextPaycheck.length > 0 && (
              <div className="glass-panel rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Bills Before Next Payday
                  </p>
                </div>
                <div className="divide-y divide-white/5">
                  {projection.billsBeforeNextPaycheck.map(bill => (
                    <div key={bill.id} className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BillerIcon icon={bill.biller?.icon} category={bill.biller?.category} name={bill.biller?.name ?? ""} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-white">{bill.biller?.name}</p>
                          <p className="text-xs text-muted-foreground">{format(parseISO(bill.dueDate), 'MMM d')}</p>
                        </div>
                      </div>
                      <p className="font-semibold text-white">{formatCurrency(bill.amountDue)}</p>
                    </div>
                  ))}
                  <div className="px-4 py-3 flex justify-between bg-white/[0.02]">
                    <span className="text-sm text-muted-foreground font-medium">Total</span>
                    <span className="font-bold text-rose-400">{formatCurrency(projection.totalBeforePaycheck)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Running Balance Timeline */}
          <div className="lg:col-span-3 glass-panel rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/5 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-white">Running Balance</h3>
            </div>
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-white/[0.02]">
                <span className="text-sm text-muted-foreground">Starting balance</span>
                <span className="font-bold text-white">{formatCurrency(summary.totalBalance)}</span>
              </div>
              {projection.allEvents.map((event, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
                    event.type === 'income'
                      ? "bg-emerald-500/5 border-emerald-500/10"
                      : event.isWarning
                        ? "bg-rose-500/10 border-rose-500/20"
                        : "bg-white/[0.02] border-white/5"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      event.type === 'income' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-muted-foreground'
                    }`}>
                      {event.type === 'income'
                        ? <Banknote className="w-3.5 h-3.5" />
                        : <CreditCard className="w-3.5 h-3.5" />
                      }
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{event.label}</p>
                      <p className="text-xs text-muted-foreground">{format(event.date, 'MMM d')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${event.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {event.type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(event.amount))}
                    </p>
                    <p className={`text-xs font-semibold ${(event.runningBalance ?? 0) < 0 ? 'text-rose-400' : 'text-white/60'}`}>
                      Balance: {formatCurrency(event.runningBalance ?? 0)}
                      {event.isWarning && <AlertTriangle className="inline w-3 h-3 ml-1 text-rose-400" />}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
            summary.upcomingBills.map((bill) => {
              const isInDanger = projection?.allEvents.find(
                e => e.type === 'bill' && e.label === bill.biller?.name && e.isWarning
              );
              return (
                <div key={bill.id} className="p-4 hover:bg-white/[0.02] transition-colors flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <BillerIcon
                      icon={bill.biller?.icon}
                      category={bill.biller?.category}
                      name={bill.biller?.name ?? ""}
                    />
                    <div>
                      <p className="font-semibold text-white group-hover:text-primary transition-colors flex items-center gap-2">
                        {bill.biller?.name}
                        {isInDanger && (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" title="May overdraft" />
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Due {format(parseISO(bill.dueDate), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg text-white mb-1">{formatCurrency(bill.amountDue)}</p>
                    <StatusBadge status={bill.status} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
