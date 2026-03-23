import { useState, useRef, useEffect } from "react";
import { Bell, X, AlertTriangle, Clock, TrendingDown, CheckCircle2 } from "lucide-react";
import { useGetBillInstances, useGetDashboardSummary } from "@workspace/api-client-react";
import { format, parseISO, isToday, isTomorrow, isPast, startOfDay } from "date-fns";
import { formatCurrency, toNumber } from "@/lib/utils";

type Notification = {
  id: string;
  type: "overdue" | "due-tomorrow" | "low-balance" | "due-today";
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: bills } = useGetBillInstances();
  const { data: summary } = useGetDashboardSummary();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const notifications: Notification[] = [];

  if (bills) {
    const today = startOfDay(new Date());

    for (const bill of bills) {
      if (bill.status === "paid") continue;

      let due: Date;
      try {
        due = parseISO(bill.dueDate);
      } catch {
        continue;
      }

      const name = bill.biller?.name || "Bill";
      const amount = formatCurrency(bill.amountDue);

      if (isToday(due) && bill.status !== "paid") {
        notifications.push({
          id: `today-${bill.id}`,
          type: "due-today",
          title: `${name} is due TODAY`,
          description: `${amount} — don't forget to pay this today.`,
          severity: "high",
        });
      } else if (isTomorrow(due)) {
        notifications.push({
          id: `tomorrow-${bill.id}`,
          type: "due-tomorrow",
          title: `Bill Due Tomorrow`,
          description: `${name} — ${amount} due ${format(due, "MMMM d")}.`,
          severity: "medium",
        });
      } else if (isPast(due) && due < today) {
        notifications.push({
          id: `overdue-${bill.id}`,
          type: "overdue",
          title: `${name} is Overdue`,
          description: `${amount} was due ${format(due, "MMMM d")} — mark it paid or it may affect your score.`,
          severity: "high",
        });
      }
    }
  }

  if (summary) {
    const safetyGap = toNumber(summary.safetyGap);
    if (safetyGap !== null && safetyGap < 200 && safetyGap > -99999) {
      notifications.push({
        id: "low-balance",
        type: "low-balance",
        title: "Low Balance Warning",
        description: `Your Safety Gap is ${formatCurrency(safetyGap)} — you're cutting it close after paying all bills this month.`,
        severity: safetyGap < 0 ? "high" : "medium",
      });
    }
  }

  notifications.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });

  const count = notifications.length;

  const icons = {
    overdue: <AlertTriangle className="w-4 h-4 text-rose-400" />,
    "due-tomorrow": <Clock className="w-4 h-4 text-amber-400" />,
    "due-today": <AlertTriangle className="w-4 h-4 text-orange-400" />,
    "low-balance": <TrendingDown className="w-4 h-4 text-amber-400" />,
  };

  const bgColors = {
    overdue: "bg-rose-500/10 border-rose-500/20",
    "due-tomorrow": "bg-amber-500/10 border-amber-500/20",
    "due-today": "bg-orange-500/10 border-orange-500/20",
    "low-balance": "bg-amber-500/10 border-amber-500/20",
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/10 transition-all"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-lg shadow-rose-500/50">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 bg-card border border-white/10 rounded-2xl shadow-2xl shadow-black/50 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h3 className="font-semibold text-white text-sm">Notifications</h3>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-6 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500/50 mx-auto mb-2" />
                <p className="text-sm text-white font-medium">All clear!</p>
                <p className="text-xs text-muted-foreground mt-1">No bills due soon and your balance looks healthy.</p>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-3 rounded-xl border ${bgColors[n.type]} flex gap-3`}
                  >
                    <div className="mt-0.5 shrink-0">{icons[n.type]}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white leading-tight">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
