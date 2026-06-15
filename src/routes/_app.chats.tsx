import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, MessageSquare, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/chats")({
  component: ChatsPage,
});

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
      {initials || "??"}
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

      const peerIds = [
        ...new Set(
          [...seen.values()].map((m) =>
            m.sender_id === user.id ? m.receiver_id : m.sender_id
          )
        ),
      ];

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
    <div className="min-h-screen bg-white pb-24 dark:bg-zinc-950">
      {/* Structural Minimalist Header Group */}
      <header className="px-4 pt-7 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Messages
        </h1>
        <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 mt-0.5">
          {threads?.length ?? 0} active conversation{(threads?.length ?? 0) !== 1 ? "s" : ""}
        </p>
      </header>

      <div className="mx-auto max-w-md px-4">
        {/* Active Query States */}
        {isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-400 dark:text-zinc-600" />
          </div>
        )}

        {!isLoading && !threads?.length && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-50 text-zinc-400 dark:bg-zinc-900/60 dark:text-zinc-600">
              <MessageSquare className="h-5 w-5" />
            </div>
            <p className="mt-4 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              No conversations yet
            </p>
            <p className="mt-1 text-[11px] text-zinc-400 max-w-[200px] leading-relaxed dark:text-zinc-500">
              Accept or submit a platform bid to initiate communication.
            </p>
          </div>
        )}

        {/* Clean Thread Feed Rows */}
        <div className="mt-2 divide-y divide-zinc-50 dark:divide-zinc-900/40">
          {threads?.map(({ key, m, peer, peerName }) => (
            <Link
              key={key}
              to="/chat/$id/$peer"
              params={{ id: m.assignment_id, peer }}
              className="group flex items-center gap-3.5 py-4 text-left transition-opacity active:opacity-75"
            >
              <Avatar name={peerName} />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm text-zinc-800 truncate dark:text-zinc-100">
                    {peerName}
                  </span>
                  <span className="text-[10px] font-medium text-zinc-400 shrink-0 dark:text-zinc-600">
                    {formatDistanceToNow(new Date(m.created_at), { addSuffix: false })}
                  </span>
                </div>
                
                {/* Embedded Context Hierarchy */}
                <p className="text-[11px] font-medium text-zinc-400 truncate dark:text-zinc-500">
                  {(m.assignment as any)?.title}
                </p>
                <p className="text-xs text-zinc-500 truncate mt-0.5 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-200 transition-colors">
                  {m.content}
                </p>
              </div>

              {/* Minimalist interactive directional prompt */}
              <ArrowRight className="h-3.5 w-3.5 text-zinc-300 opacity-0 group-hover:opacity-100 transition-all dark:text-zinc-700 shrink-0" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
