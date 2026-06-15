import { Link, useRouterState } from "@tanstack/react-router";
import { Home, PlusCircle, MessageCircle, User, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/use-admin";

const baseItems = [
  { to: "/feed",   icon: Home,          label: "Feed"    },
  { to: "/post",   icon: PlusCircle,    label: "Post"    },
  { to: "/chats",  icon: MessageCircle, label: "Chats"   },
  { to: "/profile", icon: User,          label: "Profile" },
] as const;

const adminItem = { to: "/admin", icon: Shield, label: "Admin" } as const;

export function BottomNav() {
  const path    = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = useIsAdmin();

  // Hide navigation entirely on sub-level chat threads for a focused conversation layout
  if (path.startsWith("/chat/")) return null;

  const items  = isAdmin ? [...baseItems, adminItem] : baseItems;
  const cols   = items.length === 5 ? "grid-cols-5" : "grid-cols-4";

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-zinc-100 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_12px_rgba(0,0,0,0.02)] backdrop-blur-md dark:border-zinc-800/60 dark:bg-zinc-900/95">
      <div className={cn("mx-auto max-w-md grid h-16 px-2", cols)}>
        {items.map(({ to, icon: Icon, label }) => {
          const active =
            path === to ||
            (to !== "/feed" && path.startsWith(to + "/"));
          
          return (
            <Link
              key={to}
              to={to}
              className="relative flex flex-col items-center justify-center gap-1 text-[10px] focus:outline-none select-none"
            >
              {/* Premium Top Indicator Line (Mimics high-end native mobile architectures) */}
              {active && (
                <span className="absolute top-0 h-0.5 w-6 rounded-full bg-zinc-900 dark:bg-zinc-50 animation-fade-in" />
              )}

              {/* Icon Container with subtle, responsive visual weighting */}
              <div
                className={cn(
                  "flex items-center justify-center transition-colors duration-150",
                  active 
                    ? "text-zinc-900 dark:text-zinc-50" 
                    : "text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                )}
              >
                <Icon className={cn("h-5 w-5 stroke-[2]", active && "stroke-[2.3]")} />
              </div>

              {/* Label Typography with crisp letter tracking */}
              <span
                className={cn(
                  "transition-colors duration-150 tracking-wide",
                  active 
                    ? "font-semibold text-zinc-900 dark:text-zinc-50" 
                    : "font-medium text-zinc-400 dark:text-zinc-500"
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
