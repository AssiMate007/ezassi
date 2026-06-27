import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { MessageCircle, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/chats")({
  component: ChatsPage,
});

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const colors = ["bg-violet-500","bg-fuchsia-500","bg-pink-500","bg-indigo-500","bg-cyan-500","bg-emerald-500"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`${color} h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0`}>
      {initials}
    </div>
  );
}

function ChatsPage() {
  const { user } = useAuth();

  const { data: threads, isLoading } = useQuery({
    queryKey: ["threads", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("messages")
        .select("assignment_id, sender_id, receiver_id, content, created_at, assignment:assignments(title)")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;

      const seen = new Map<string, typeof data[number]>();
      for (const m of data ?? []) {
        const peer = m.sender_id === user.id ? m.receiver_id : m.sender_id;
        const key = `${m.assignment_id}:${peer}`;
        if (!seen.has(key)) seen.set(key, m);
      }

      const peerIds = [...new Set([...seen.values()].map((m) =>
        m.sender_id === user.id ? m.receiver_id : m.sender_id
      ))];

      const { data: profiles } = peerIds.length
        ? await supabase.from("profiles").select("id, display_name").in("id", peerIds)
        : { data: [] };

      const pmap = new Map(profiles?.map((p) => [p.id, p]) ?? []);

      return [...seen.entries()].map(([key, m]) => {
        const peer = m.sender_id === user.id ? m.receiver_id : m.sender_id;
        return { key, m, peer, peerName: pmap.get(peer)?.display_name ?? "Unknown" };
      });
    },
  });

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="bg-gradient-hero px-4 pt-10 pb-7 text-primary-foreground relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="relative">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageCircle className="h-6 w-6" />Messages
          </h1>
          <p className="text-sm text-primary-foreground/75 mt-0.5">
            {threads?.length ?? 0} conversation{(threads?.length ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="px-4 -mt-3 relative z-10">
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {!isLoading && !threads?.length && (
          <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border mt-3">
            <div className="text-5xl mb-3 animate-float">💬</div>
            <p className="font-semibold">No conversations yet</p>
            <p className="text-sm text-muted-foreground mt-1">Accept or submit a bid to start chatting</p>
          </div>
        )}

        <div className="space-y-2 mt-3">
          {threads?.map(({ key, m, peer, peerName }) => (
            <Link key={key} to="/chat/$id/$peer" params={{ id: m.assignment_id, peer }}
              className="flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200">
              <Avatar name={peerName} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold truncate">{peerName}</p>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{(m.assignment as any)?.title}</p>
                <p className="text-sm text-foreground/70 truncate mt-0.5">{m.content}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
