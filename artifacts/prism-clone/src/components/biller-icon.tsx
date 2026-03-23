import {
  Tv2, Music2, Zap, Wifi, Home, Car, HeartPulse,
  Phone, Smartphone, ShoppingBag, Package, Film, Building2, Landmark, Shield,
  Coffee, Gamepad2, BookOpen, Plane, Utensils, Dumbbell, Activity,
} from "lucide-react";

const ICON_MAP: Record<string, React.ReactNode> = {
  tv: <Tv2 className="w-5 h-5" />,
  music: <Music2 className="w-5 h-5" />,
  zap: <Zap className="w-5 h-5" />,
  wifi: <Wifi className="w-5 h-5" />,
  home: <Home className="w-5 h-5" />,
  house: <Home className="w-5 h-5" />,
  car: <Car className="w-5 h-5" />,
  heart: <HeartPulse className="w-5 h-5" />,
  activity: <Activity className="w-5 h-5" />,
  phone: <Phone className="w-5 h-5" />,
  smartphone: <Smartphone className="w-5 h-5" />,
  prime: <Package className="w-5 h-5" />,
  package: <Package className="w-5 h-5" />,
  shopping: <ShoppingBag className="w-5 h-5" />,
  movie: <Film className="w-5 h-5" />,
  film: <Film className="w-5 h-5" />,
  bank: <Landmark className="w-5 h-5" />,
  shield: <Shield className="w-5 h-5" />,
  insurance: <Shield className="w-5 h-5" />,
  coffee: <Coffee className="w-5 h-5" />,
  game: <Gamepad2 className="w-5 h-5" />,
  book: <BookOpen className="w-5 h-5" />,
  plane: <Plane className="w-5 h-5" />,
  food: <Utensils className="w-5 h-5" />,
  gym: <Dumbbell className="w-5 h-5" />,
  fitness: <Dumbbell className="w-5 h-5" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  Entertainment: "from-purple-500/20 to-pink-500/20 border-purple-500/30 text-purple-400",
  Utilities: "from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-400",
  Housing: "from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400",
  Insurance: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400",
  Health: "from-rose-500/20 to-red-500/20 border-rose-500/30 text-rose-400",
  Subscriptions: "from-violet-500/20 to-purple-500/20 border-violet-500/30 text-violet-400",
  Food: "from-orange-500/20 to-yellow-500/20 border-orange-500/30 text-orange-400",
  Transport: "from-sky-500/20 to-blue-500/20 border-sky-500/30 text-sky-400",
};

interface BillerIconProps {
  icon?: string | null;
  category?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
}

export function BillerIcon({ icon, category, name, size = "md" }: BillerIconProps) {
  const colorClass = CATEGORY_COLORS[category ?? ""] ?? "from-indigo-500/20 to-purple-500/20 border-indigo-500/30 text-indigo-400";
  const iconKey = icon?.toLowerCase().trim() ?? "";
  const lucideIcon = ICON_MAP[iconKey];

  const sizeClass = {
    sm: "w-10 h-10 rounded-xl",
    md: "w-12 h-12 rounded-xl",
    lg: "w-14 h-14 rounded-2xl",
  }[size];

  return (
    <div className={`${sizeClass} bg-gradient-to-br ${colorClass} border flex items-center justify-center flex-shrink-0`}>
      {lucideIcon ?? (
        icon && icon.length <= 4 ? (
          <span className="text-sm font-bold">{icon}</span>
        ) : (
          <span className="text-sm font-bold text-white/60">
            {name.slice(0, 2).toUpperCase()}
          </span>
        )
      )}
    </div>
  );
}
