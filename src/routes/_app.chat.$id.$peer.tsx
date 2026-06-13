import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, IndianRupee, CheckCircle2, Smile } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";

export const Route = createFileRoute("/_app/chat/$id/$peer")({
  component: ChatPage,
});

interface Msg {
  id: string;
  content: string;
  offer_amount: number | null;
  sender_id: string;
  created_at: string;
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const colors = ["bg-violet-500","bg-fuchsia-500","bg-pink-500","bg-indigo-500","bg-cyan-500","bg-emerald-500"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`${color} rounded-full flex items-center justify-center text-white font-bold shrink-0`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials}
    </div>
  );
}

function DateDivider({ date }: { date: string }) {
  const d = new Date(date);
  const label = isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : format(d, "MMM d, yyyy");
  return (
    <div className="flex items-center gap-3 my-3">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[11px] text-muted-foreground font-medium px-2">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function ChatPage() {
  const { id, peer } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [offer, setOffer] = useState("");
  const [showOffer, setShowOffer] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: peerProfile } = useQuery({
    queryKey: ["profile", peer],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", peer).single();
      return data;
    },
  });

  const { data: assignment } = useQuery({
    queryKey: ["assignment", id],
    queryFn: async () => {
      const { data } = await supabase.from("assignments").select("title,status").eq("id", id).single();
      return data;
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["messages", id, peer],
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("assignment_id", id)
        .or(`and(sender_id.eq.${user?.id},receiver_id.eq.${peer}),and(sender_id.eq.${peer},receiver_id.eq.${user?.id})`)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`chat-${id}-${user.id}-${peer}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
        filter: `assignment_id=eq.${id}`,
      }, () => qc.invalidateQueries({ queryKey: ["messages", id, peer] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, peer, user, qc]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || (!text.trim() && !offer)) return;
    const payload = {
      assignment_id: id,
      sender_id: user.id,
      receiver_id: peer,
      content: text.trim() || `New offer: ₹${offer}`,
      offer_amount: offer ? parseInt(offer) : null,
    };
    const { error } = await supabase.from("messages").insert(payload);
    if (error) return toast.error(error.message);
    setText(""); setOffer(""); setShowOffer(false);
    qc.invalidateQueries({ queryKey: ["messages", id, peer] });
    inputRef.current?.focus();
  };

  const acceptOffer = async (m: Msg) => {
    if (!m.offer_amount) return;
    await supabase.from("messages").insert({
      assignment_id: id, sender_id: user!.id, receiver_id: peer,
      content: `✅ Accepted ₹${m.offer_amount}`,
    });
    toast.success(`Offer of ₹${m.offer_amount} accepted!`);
    qc.invalidateQueries({ queryKey: ["messages", id, peer] });
  };

  // Group messages by date for dividers
  const grouped = (messages ?? []).reduce<{ date: string; msgs: Msg[] }[]>((acc, m) => {
    const d = m.created_at.slice(0, 10);
    const last = acc[acc.length - 1];
    if (!last || last.date !== d) acc.push({ date: d, msgs: [m] });
    else last.msgs.push(m);
    return acc;
  }, []);

  return (
    <div className="flex flex-col h-[100dvh]" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-card/90 backdrop-blur-lg border-b border-border sticky top-0 z-20 shadow-xs">
        <Link to="/assignment/$id" params={{ id }}
          className="h-9 w-9 rounded-xl flex items-center justify-center hover:bg-muted transition shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Link>

        {peerProfile && <Avatar name={peerProfile.display_name} size={38} />}

        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate leading-tight">
            {peerProfile?.display_name ?? "Chat"}
          </p>
          {assignment && (
            <p className="text-xs text-muted-foreground truncate">{assignment.title}</p>
          )}
        </div>

        <Link to="/assignment/$id" params={{ id }}
          className="shrink-0 text-xs text-primary bg-primary/10 px-3 py-1.5 rounded-full font-medium hover:bg-primary/20 transition">
          View assignment
        </Link>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-gradient-soft scrollbar-none">
        {messages?.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="text-5xl animate-float">👋</div>
            <p className="font-semibold">Say hi to {peerProfile?.display_name?.split(" ")[0] ?? "them"}!</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Discuss the assignment details, ask questions, or send an offer.
            </p>
          </div>
        )}

        {grouped.map(({ date, msgs }) => (
          <div key={date}>
            <DateDivider date={date} />
            <div className="space-y-1.5">
              {msgs.map((m, i) => {
                const mine = m.sender_id === user?.id;
                const prevSame = i > 0 && msgs[i-1].sender_id === m.sender_id;
                const nextSame = i < msgs.length-1 && msgs[i+1].sender_id === m.sender_id;
                const time = format(new Date(m.created_at), "h:mm a");

                if (m.offer_amount) {
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"} mb-2`}>
                      <div className={`max-w-[75%] rounded-3xl p-4 border-2 shadow-soft ${
                        mine ? "bg-primary/5 border-primary/40" : "bg-card border-accent/40"
                      }`}>
                        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-1">
                          {mine ? "Your offer" : "Offer received"}
                        </p>
                        <div className="flex items-center text-3xl font-bold text-primary">
                          <IndianRupee className="h-6 w-6" />{m.offer_amount}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{time}</p>
                        {!mine && (
                          <Button size="sm" className="mt-3 w-full bg-gradient-primary rounded-2xl shadow-soft" onClick={() => acceptOffer(m)}>
                            <CheckCircle2 className="h-4 w-4 mr-1.5" />Accept offer
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={m.id} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                    {/* Avatar for other person — only on last in group */}
                    {!mine && (
                      <div className="shrink-0 mb-0.5">
                        {!nextSame && peerProfile
                          ? <Avatar name={peerProfile.display_name} size={28} />
                          : <div className="w-7" />}
                      </div>
                    )}

                    <div className={`flex flex-col ${mine ? "items-end" : "items-start"} max-w-[72%]`}>
                      <div className={`px-4 py-2.5 text-sm leading-relaxed shadow-xs ${
                        mine
                          ? `bg-gradient-primary text-primary-foreground ${
                              prevSame ? "rounded-[20px_20px_6px_20px]" : "rounded-[20px_20px_6px_20px]"
                            }`
                          : `bg-card border border-border text-foreground ${
                              prevSame ? "rounded-[6px_20px_20px_20px]" : "rounded-[6px_20px_20px_20px]"
                            }`
                      }`}>
                        {m.content}
                      </div>
                      {!nextSame && (
                        <p className="text-[10px] text-muted-foreground mt-1 px-1">{time}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="bg-card border-t border-border px-3 pt-2 pb-3">
        {showOffer && (
          <div className="mb-2 flex items-center gap-2 bg-primary/8 rounded-2xl px-3 py-2">
            <IndianRupee className="h-4 w-4 text-primary shrink-0" />
            <Input
              type="number" placeholder="Enter offer amount"
              value={offer} onChange={(e) => setOffer(e.target.value)}
              className="border-none bg-transparent p-0 h-auto focus-visible:ring-0 font-semibold text-primary text-base"
              inputMode="numeric" autoFocus
            />
            <button onClick={() => { setShowOffer(false); setOffer(""); }}
              className="text-xs text-muted-foreground hover:text-foreground px-2">✕</button>
          </div>
        )}
        <form onSubmit={send} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowOffer((v) => !v)}
            className={`shrink-0 h-10 w-10 rounded-2xl flex items-center justify-center transition ${
              showOffer ? "bg-gradient-primary text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground hover:text-primary"
            }`}
            aria-label="Make offer"
          >
            <IndianRupee className="h-4 w-4" />
          </button>
          <Input
            ref={inputRef}
            placeholder="Message…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 h-10 rounded-2xl bg-muted border-none focus-visible:ring-1 focus-visible:ring-primary"
          />
          <Button
            type="submit"
            disabled={!text.trim() && !offer}
            size="icon"
            className="h-10 w-10 rounded-2xl bg-gradient-primary shadow-soft shrink-0 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
