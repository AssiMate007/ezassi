import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/chats")({
  component: ChatsPage,
});

function ChatsPage() {
  const { user } = useAuth();

  const { data: threads } = useQuery({
    queryKey: ["threads", user?.id],
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
      const peerIds = [...new Set([...seen.values()].map((m) => m.sender_id === user.id ? m.receiver_id : m.sender_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", peerIds);
      const pmap = new Map(profiles?.map((p) => [p.id, p]) ?? []);
      return [...seen.entries()].map(([key, m]) => {
        const peer = m.sender_id === user.id ? m.receiver_id : m.sender_id;
        return { key, m, peer, peerName: pmap.get(peer)?.display_name ?? "Unknown" };
      });
    },
    enabled: !!user,
  });

  return (
    <div className="px-4 pt-6 pb-4">
      <h1 className="text-2xl font-bold mb-5">Chats</h1>
      {!threads?.length && (
        <div className="text-center py-20">
          <MessageCircle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground">No conversations yet</p>
        </div>
      )}
      <div className="space-y-2">
        {threads?.map(({ key, m, peer, peerName }) => (
          <Link
            key={key}
            to="/chat/$id/$peer"
            params={{ id: m.assignment_id, peer }}
            className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-card hover:shadow-soft transition"
          >
            <div className="h-12 w-12 rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center font-bold">
              {peerName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold truncate">{peerName}</p>
                <span className="text-xs text-muted-foreground shrink-0">{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{m.assignment?.title}</p>
              <p className="text-sm text-foreground/80 truncate">{m.content}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
