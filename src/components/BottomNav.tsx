import { Link, useRouterState } from "@tanstack/react-router";
import { Home, PlusCircle, MessageCircle, User, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/use-admin";

const baseItems = [
  { to: "/feed",    icon: Home,          label: "Feed"    },
  { to: "/post",    icon: PlusCircle,    label: "Post"    },
  { to: "/chats",   icon: MessageCircle, label: "Chats"   },
  { to: "/profile", icon: User,          label: "Profile" },
] as const;

const adminItem = { to: "/admin", icon: Shield, label: "Admin" } as const;

export function BottomNav() {
  const path    = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = useIsAdmin();

  // Hide on chat detail page
  if (path.startsWith("/chat/")) return null;

  const items = isAdmin ? [...baseItems, adminItem] : baseItems;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 pointer-events-none">
      <div className="mx-auto max-w-md px-4 pb-3 pointer-events-auto">
        <div className="glass rounded-3xl border border-border/60 shadow-glow px-2 py-1.5">
          <div
            className="grid"
            style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
          >
            {items.map(({ to, icon: Icon, label }) => {
              const active =
                path === to ||
                (to !== "/feed" && path.startsWith(to + "/"));
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-0.5 py-2 rounded-2xl transition-all duration-300",
                    active
                      ? "text-white"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {active && (
                    <span className="absolute inset-0 rounded-2xl bg-black shadow-soft" />
                  )}
                  <div className="relative flex flex-col items-center gap-0.5">
                    <Icon
                      className={cn(
                        "h-5 w-5 transition-transform duration-300",
                        active && "scale-110",
                        active ? "text-white" : "text-current",
                      )}
                      strokeWidth={active ? 2.4 : 2}
                    />
                    <span
                      className={cn(
                        "text-[10px] leading-none tracking-wide",
                        active ? "font-semibold text-white" : "font-medium",
                      )}
                    >
                      {label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
