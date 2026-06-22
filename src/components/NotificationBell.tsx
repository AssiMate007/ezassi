import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Notif {
  id: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  const unread = notifs.filter((n) => !n.read).length;

  // Fetch on mount
  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      setNotifs((data ?? []) as Notif[]);
    };
    fetch();

    // Realtime — new notification comes in, show a toast AND add to list
    const ch = supabase
      .channel(`notifs-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as Notif;
          setNotifs((prev) => [n, ...prev]);
          // Show toast immediately
          toast(n.title, {
            description: n.body,
            action: n.link ? { label: "View", onClick: () => { window.location.href = n.link!; } } : undefined,
            duration: 6000,
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const markAllRead = async () => {
    if (!user || unread === 0) return;
    await supabase
      .from("notifications")
      .update({ read: true } as never)
      .eq("user_id", user.id)
      .eq("read", false);
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen((v) => !v); if (!open) markAllRead(); }}
        className="relative h-9 w-9 rounded-xl flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 top-11 z-50 w-80 max-h-96 overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
              <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Notifications</p>
              {unread > 0 && (
                <button onClick={markAllRead} className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                  Mark all read
                </button>
              )}
            </div>

            {notifs.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="h-8 w-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No notifications yet</p>
              </div>
            ) : notifs.map((n) => (
              <a
                key={n.id}
                href={n.link ?? "#"}
                onClick={() => setOpen(false)}
                className={`block px-4 py-3 border-b border-zinc-50 dark:border-zinc-800/50 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition ${
                  !n.read ? "bg-blue-50/60 dark:bg-blue-950/20" : ""
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {!n.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 shrink-0" />}
                  <div className={!n.read ? "" : "ml-4"}>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">{n.title}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">{n.body}</p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
