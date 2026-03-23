import { useState } from "react";
import { useGetBillInstances } from "@workspace/api-client-react";
import { 
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  eachDayOfInterval, format, isSameMonth, isSameDay, 
  addMonths, subMonths, parseISO
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import { formatCurrency } from "@/lib/utils";
import { BillInstance } from "@workspace/api-client-react";

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Fetching bills for a wider range could be optimized by passing month/year, 
  // but we'll use the unfiltered list and filter client-side for simplicity here.
  const { data: bills = [], isLoading } = useGetBillInstances();

  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const daysInterval = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getDayBills = (day: Date) => {
    return bills.filter(bill => isSameDay(parseISO(bill.dueDate), day));
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'paid': return 'bg-emerald-500';
      case 'overdue': return 'bg-rose-500';
      case 'scheduled': return 'bg-blue-500';
      case 'unpaid': default: return 'bg-yellow-500';
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display font-bold text-gradient">Calendar</h1>
        
        <div className="flex items-center gap-4 bg-card border border-white/10 rounded-xl p-1">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-semibold w-32 text-center text-white">
            {format(currentDate, "MMMM yyyy")}
          </span>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 glass-panel rounded-2xl overflow-hidden flex flex-col border border-white/10">
        <div className="grid grid-cols-7 border-b border-white/10 bg-white/[0.02]">
          {weekDays.map(day => (
            <div key={day} className="py-3 text-center text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>
        
        <div className="flex-1 grid grid-cols-7 grid-rows-5 lg:grid-rows-auto bg-white/5 gap-[1px]">
          {daysInterval.map((day, i) => {
            const dayBills = getDayBills(day);
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isToday = isSameDay(day, new Date());

            return (
              <div 
                key={day.toISOString()} 
                className={clsx(
                  "bg-card min-h-[100px] p-2 flex flex-col transition-colors",
                  !isCurrentMonth && "opacity-40",
                  "hover:bg-white/[0.04]"
                )}
              >
                <div className="flex justify-between items-start">
                  <span className={clsx(
                    "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                    isToday ? "bg-primary text-primary-foreground shadow-lg shadow-primary/40" : "text-muted-foreground"
                  )}>
                    {format(day, "d")}
                  </span>
                  
                  {dayBills.length > 0 && (
                    <span className="text-[10px] font-bold text-muted-foreground">
                      {dayBills.length} due
                    </span>
                  )}
                </div>

                <div className="mt-auto space-y-1 overflow-y-auto max-h-[80px] no-scrollbar">
                  {dayBills.map(bill => (
                    <div 
                      key={bill.id} 
                      className="text-xs p-1 rounded bg-white/5 border border-white/5 flex items-center justify-between truncate"
                      title={`${bill.biller?.name} - ${formatCurrency(bill.amountDue)}`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${getStatusColor(bill.status)} shadow-[0_0_5px_currentColor]`} />
                        <span className="truncate text-white/80 font-medium">{bill.biller?.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
