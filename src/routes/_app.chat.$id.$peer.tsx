import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, IndianRupee, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

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

function ChatPage() {
  const { id, peer } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [offer, setOffer] = useState("");
  const [showOffer, setShowOffer] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const { data: peerProfile } = useQuery({
    queryKey: ["profile", peer],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", peer).single();
      return data;
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["messages", id, peer],
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
    const channel = supabase
      .channel(`chat-${id}-${user.id}-${peer}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `assignment_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["messages", id, peer] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
      content: text || (offer ? `New offer: ₹${offer}` : ""),
      offer_amount: offer ? parseInt(offer) : null,
    };
    const { error } = await supabase.from("messages").insert(payload);
    if (error) return toast.error(error.message);
    setText(""); setOffer(""); setShowOffer(false);
    qc.invalidateQueries({ queryKey: ["messages", id, peer] });
  };

  const acceptOffer = async (m: Msg) => {
    if (!m.offer_amount) return;
    toast.success(`Offer of ₹${m.offer_amount} accepted!`);
    await supabase.from("messages").insert({
      assignment_id: id, sender_id: user!.id, receiver_id: peer,
      content: `✅ Accepted ₹${m.offer_amount}`,
    });
    qc.invalidateQueries({ queryKey: ["messages", id, peer] });
  };

  return (
    <div className="flex flex-col h-[100dvh] -mb-24">
      <header className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border sticky top-0 z-10">
        <button onClick={() => navigate({ to: "/assignment/$id", params: { id } })}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{peerProfile?.display_name ?? "Chat"}</p>
          <p className="text-xs text-muted-foreground">about the assignment</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-gradient-soft">
        {messages?.length === 0 && (
          <div className="text-center py-10 text-sm text-muted-foreground">Say hi 👋</div>
        )}
        {messages?.map((m) => {
          const mine = m.sender_id === user?.id;
          if (m.offer_amount) {
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl p-3 border-2 ${mine ? "bg-primary/5 border-primary" : "bg-card border-accent"}`}>
                  <p className="text-xs text-muted-foreground mb-1">{mine ? "Your offer" : "New offer"}</p>
                  <div className="flex items-center text-2xl font-bold text-primary">
                    <IndianRupee className="h-5 w-5" />{m.offer_amount}
                  </div>
                  {!mine && (
                    <Button size="sm" className="mt-2 w-full bg-gradient-primary" onClick={() => acceptOffer(m)}>
                      <CheckCircle2 className="h-4 w-4 mr-1" />Accept
                    </Button>
                  )}
                </div>
              </div>
            );
          }
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                mine ? "bg-gradient-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border rounded-bl-sm"
              }`}>
                {m.content}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="p-3 bg-card border-t border-border space-y-2">
        {showOffer && (
          <div className="relative">
            <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input type="number" placeholder="Offer amount" value={offer} onChange={(e) => setOffer(e.target.value)} className="pl-8" />
          </div>
        )}
        <div className="flex gap-2 items-center">
          <button type="button" onClick={() => setShowOffer((v) => !v)}
            className={`shrink-0 rounded-full p-2.5 transition ${showOffer ? "bg-gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            <IndianRupee className="h-4 w-4" />
          </button>
          <Input placeholder="Message…" value={text} onChange={(e) => setText(e.target.value)} className="flex-1" />
          <Button type="submit" size="icon" className="bg-gradient-primary shrink-0"><Send className="h-4 w-4" /></Button>
        </div>
      </form>
    </div>
  );
}
