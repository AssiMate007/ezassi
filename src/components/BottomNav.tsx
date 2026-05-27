import { Link, useRouterState } from "@tanstack/react-router";
import { Home, PlusCircle, MessageCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/feed", icon: Home, label: "Feed" },
  { to: "/post", icon: PlusCircle, label: "Post" },
  { to: "/chats", icon: MessageCircle, label: "Chats" },
  { to: "/profile", icon: User, label: "Profile" },
] as const;

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur-lg">
      <div className="mx-auto max-w-md grid grid-cols-4">
        {items.map(({ to, icon: Icon, label }) => {
          const active = path === to || path.startsWith(to + "/");
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <div className={cn(
                "rounded-full p-2 transition-all",
                active && "bg-gradient-primary text-primary-foreground shadow-soft",
              )}>
                <Icon className="h-5 w-5" />
              </div>
              {label}
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
