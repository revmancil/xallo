import { useState } from "react";
import {
  useGetBillInstances,
  useGetIncomeEntries,
  useUpdateBillInstance,
} from "@workspace/api-client-react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay,
  addMonths, subMonths, parseISO, isAfter, startOfDay,
} from "date-fns";
import { ChevronLeft, ChevronRight, X, Check, CheckCircle2, Banknote, AlertTriangle } from "lucide-react";
import { clsx } from "clsx";
import { formatCurrency, toNumber } from "@/lib/utils";
import { BillerIcon } from "@/components/biller-icon";
import { StatusBadge } from "@/components/status-badge";
import { useQueryClient } from "@tanstack/react-query";
import { getGetBillInstancesQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [justPaidIds, setJustPaidIds] = useState<Set<number>>(new Set());

  const queryClient = useQueryClient();
  const { data: bills = [], isLoading: billsLoading } = useGetBillInstances();
  const { data: incomeEntries = [] } = useGetIncomeEntries();

  const updateMutation = useUpdateBillInstance({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBillInstancesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      }
    }
  });

  const handleMarkPaid = (id: number) => {
    setJustPaidIds(prev => new Set(prev).add(id));
    updateMutation.mutate({ billId: id, data: { status: "paid", paidAt: new Date().toISOString() } });
    setTimeout(() => {
      setJustPaidIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }, 1600);
  };

  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const daysInterval = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getDayBills = (day: Date) =>
    bills.filter(bill => isSameDay(parseISO(bill.dueDate), day));

  const getDayIncome = (day: Date) =>
    incomeEntries.filter(inc => isSameDay(parseISO(inc.payDate), day));

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-emerald-500';
      case 'overdue': return 'bg-rose-500 animate-pulse';
      case 'scheduled': return 'bg-blue-500';
      default: return 'bg-yellow-400';
    }
  };

  const selectedDayBills = selectedDay ? getDayBills(selectedDay) : [];
  const selectedDayIncome = selectedDay ? getDayIncome(selectedDay) : [];
  const hasSelectedContent = selectedDayBills.length > 0 || selectedDayIncome.length > 0;

  return (
    <div className="space-y-3 h-full flex flex-col">
      {/* Mobile: title then month nav stacked; Desktop: side by side */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-gradient">Calendar</h1>
        <div className="flex items-center justify-between sm:justify-end gap-3">
          <div className="flex items-center gap-1 bg-card border border-white/10 rounded-xl p-1">
            <button onClick={prevMonth} className="p-1.5 sm:p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors">
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <span className="font-semibold w-28 sm:w-32 text-center text-white text-sm sm:text-base">
              {format(currentDate, "MMM yyyy")}
            </span>
            <button onClick={nextMonth} className="p-1.5 sm:p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors">
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
          {/* Legend inline on mobile next to month nav */}
          <div className="flex items-center gap-2 sm:hidden text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" /></span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /></span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /></span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /></span>
          </div>
        </div>
      </div>
      {/* Full legend — only visible on desktop */}
      <div className="hidden sm:flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Unpaid</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Overdue</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Scheduled</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Paid / Payday</span>
      </div>

      <div className="flex-1 glass-panel rounded-2xl overflow-hidden flex flex-col border border-white/10">
        <div className="grid grid-cols-7 border-b border-white/10 bg-white/[0.02]">
          {weekDays.map(day => (
            <div key={day} className="py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        <div className="flex-1 grid grid-cols-7 bg-white/5 gap-[1px]">
          {daysInterval.map((day) => {
            const dayBills = getDayBills(day);
            const dayIncome = getDayIncome(day);
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isToday = isSameDay(day, new Date());
            const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
            const totalEvents = dayBills.length + dayIncome.length;
            const allEvents = [
              ...dayIncome.map(inc => ({ id: `inc-${inc.id}`, dot: "bg-emerald-500", name: inc.label, isIncome: true })),
              ...dayBills.map(bill => ({ id: `bill-${bill.id}`, dot: getStatusDot(bill.status), name: bill.biller?.name ?? "", isIncome: false })),
            ];

            return (
              <div
                key={day.toISOString()}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className={clsx(
                  "bg-card min-h-[70px] sm:min-h-[90px] p-1.5 sm:p-2 flex flex-col cursor-pointer transition-all",
                  !isCurrentMonth && "opacity-40",
                  isSelected ? "bg-primary/10 ring-1 ring-inset ring-primary/30" : "hover:bg-white/[0.04]",
                )}
              >
                <div className="flex justify-between items-start">
                  <span className={clsx(
                    "text-xs sm:text-sm font-medium w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full",
                    isToday
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/40"
                      : isSelected
                        ? "text-primary font-bold"
                        : "text-muted-foreground"
                  )}>
                    {format(day, "d")}
                  </span>

                  {totalEvents > 0 && (
                    <span className="text-[9px] font-bold text-muted-foreground leading-none mt-0.5">
                      {totalEvents}<span className="hidden sm:inline"> event{totalEvents > 1 ? "s" : ""}</span>
                    </span>
                  )}
                </div>

                {/* Mobile: just colored dots */}
                {allEvents.length > 0 && (
                  <div className="mt-1 flex sm:hidden flex-wrap gap-1 px-0.5">
                    {allEvents.slice(0, 4).map(ev => (
                      <span key={ev.id} className={clsx("w-2 h-2 rounded-full shrink-0", ev.dot)} />
                    ))}
                    {allEvents.length > 4 && (
                      <span className="text-[8px] text-muted-foreground">+{allEvents.length - 4}</span>
                    )}
                  </div>
                )}

                {/* Desktop: text chips */}
                <div className="mt-1 space-y-0.5 overflow-hidden max-h-[70px] hidden sm:block">
                  {dayIncome.map(inc => (
                    <div
                      key={`inc-${inc.id}`}
                      className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1 truncate"
                    >
                      <Banknote className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span className="truncate text-emerald-400 font-medium">{inc.label}</span>
                    </div>
                  ))}
                  {dayBills.slice(0, 2).map(bill => (
                    <div
                      key={bill.id}
                      className="text-xs px-1.5 py-0.5 rounded bg-white/5 border border-white/5 flex items-center gap-1.5 truncate"
                    >
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusDot(bill.status)}`} />
                      <span className="truncate text-white/80 font-medium">{bill.biller?.name}</span>
                    </div>
                  ))}
                  {dayBills.length > 2 && (
                    <div className="text-[10px] text-muted-foreground px-1">+{dayBills.length - 2} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day Slide-Over */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setSelectedDay(null)}>
          <div className="flex-1" />
          <div
            className="w-full max-w-sm bg-[#0d1117] border-l border-white/10 h-full overflow-y-auto shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
            style={{ animation: "slideInRight 0.25s ease-out" }}
          >
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02] sticky top-0 z-10">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">
                  {format(selectedDay, "EEEE")}
                </p>
                <h2 className="text-xl font-bold text-white">
                  {format(selectedDay, "MMMM d, yyyy")}
                </h2>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="p-2 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-5 space-y-4">
              {!hasSelectedContent && (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                    <Check className="w-6 h-6 text-emerald-500" />
                  </div>
                  <p className="font-medium text-white/60">Nothing due today</p>
                  <p className="text-sm">This day is clear.</p>
                </div>
              )}

              {selectedDayIncome.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-2">
                    Payday
                  </p>
                  <div className="space-y-2">
                    {selectedDayIncome.map(inc => (
                      <div
                        key={inc.id}
                        className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-center gap-3"
                      >
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                          <Banknote className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white">{inc.label}</p>
                          <p className="text-xs text-emerald-400 capitalize">{inc.recurrence}</p>
                        </div>
                        <p className="font-bold text-emerald-400 text-lg">{formatCurrency(inc.amount)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedDayBills.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                    Bills Due
                  </p>
                  <div className="space-y-3">
                    {selectedDayBills.map(bill => {
                      const isJustPaid = justPaidIds.has(bill.id);
                      const isPaid = bill.status === 'paid' || isJustPaid;
                      return (
                        <div
                          key={bill.id}
                          className={`rounded-xl border p-4 transition-all duration-500 ${
                            isPaid
                              ? "bg-emerald-500/5 border-emerald-500/20"
                              : bill.status === 'overdue'
                                ? "bg-rose-500/5 border-rose-500/20"
                                : "bg-white/[0.03] border-white/10"
                          }`}
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <BillerIcon
                              icon={bill.biller?.icon}
                              category={bill.biller?.category}
                              name={bill.biller?.name ?? ""}
                              size="sm"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-white truncate">{bill.biller?.name}</p>
                              <p className="text-xs text-muted-foreground">{bill.biller?.category}</p>
                            </div>
                            <p className="font-bold text-white text-lg">{formatCurrency(bill.amountDue)}</p>
                          </div>

                          <div className="flex items-center justify-between">
                            <StatusBadge status={isPaid ? "paid" : bill.status} />
                            {!isPaid && (
                              <button
                                onClick={() => handleMarkPaid(bill.id)}
                                disabled={updateMutation.isPending}
                                className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-emerald-500/25"
                              >
                                <Check className="w-4 h-4" strokeWidth={2.5} />
                                Mark as Paid
                              </button>
                            )}
                            {isPaid && (
                              <div className="flex items-center gap-1.5 text-emerald-400 text-sm font-medium">
                                <CheckCircle2 className="w-4 h-4" />
                                Paid
                              </div>
                            )}
                          </div>

                          {bill.status === 'overdue' && !isPaid && (
                            <div className="mt-2 flex items-center gap-1.5 text-rose-400 text-xs">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              This bill is overdue
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {selectedDayBills.length > 0 && (
              <div className="p-5 border-t border-white/10 bg-white/[0.02] sticky bottom-0">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Total due this day</span>
                  <span className="font-bold text-white text-lg">
                    {formatCurrency(selectedDayBills.reduce((s, b) => s + toNumber(b.amountDue), 0))}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
