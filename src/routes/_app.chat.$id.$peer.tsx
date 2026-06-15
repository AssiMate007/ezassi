import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  ArrowLeft, Send, IndianRupee, CheckCircle2, 
  ChevronDown, ChevronUp, FileText, Calendar, Compass, Info 
} from "lucide-react";
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
  const colors = ["bg-zinc-900", "bg-zinc-800", "bg-zinc-700"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`${color} rounded-full flex items-center justify-center text-white font-bold shrink-0 dark:bg-zinc-100 dark:text-zinc-900`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials || "??"}
    </div>
  );
}

function DateDivider({ date }: { date: string }) {
  const d = new Date(date);
  const label = isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : format(d, "MMM d, yyyy");
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-900" />
      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider px-2">{label}</span>
      <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-900" />
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
  const [showDetails, setShowDetails] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: peerProfile } = useQuery({
    queryKey: ["profile", peer],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", peer).single();
      return data;
    },
  });

  // CRASH FIX BOUNDARY: Securely select fields with fallback checks
  const { data: assignment } = useQuery({
    queryKey: ["assignment", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("assignments")
        .select("title, description, subject, budget_min, budget_max, deadline, status")
        .eq("id", id)
        .single();
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
  }, [messages, showDetails]);

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

  const grouped = (messages ?? []).reduce<{ date: string; msgs: Msg[] }[]>((acc, m) => {
    const d = m.created_at.slice(0, 10);
    const last = acc[acc.length - 1];
    if (!last || last.date !== d) acc.push({ date: d, msgs: [m] });
    else last.msgs.push(m);
    return acc;
  }, []);

  // SAFE DATE INTERCEPTOR: Prevents "Invalid time value" breakages gracefully
  const renderDeadline = () => {
    if (!assignment?.deadline) return "No deadline set";
    const dateParsed = new Date(assignment.deadline);
    if (isNaN(dateParsed.getTime())) return "Flexible Timeline";
    return format(dateParsed, "MMM d, yyyy");
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-zinc-50/60 dark:bg-zinc-950" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      
      {/* Premium Header Architecture */}
      <header className="sticky top-0 z-40 border-b border-zinc-100 bg-white/90 backdrop-blur-md dark:border-zinc-900 dark:bg-zinc-950/90">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/chats" className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            {peerProfile && <Avatar name={peerProfile.display_name} size={34} />}
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 truncate leading-tight">
                {peerProfile?.display_name ?? "Workspace"}
              </h1>
              <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider dark:text-zinc-500">
                {peerProfile?.role || "Partner"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1.5 rounded-full border border-zinc-100 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
          >
            <FileText className="h-3.5 w-3.5 text-zinc-400" />
            <span>Details</span>
            {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>

        {/* Collapsible Clean Assignment Details Panel */}
        {showDetails && assignment && (
          <div className="border-t border-zinc-100 bg-white p-4 animate-in slide-in-from-top-2 duration-150 dark:border-zinc-900 dark:bg-zinc-950">
            <div className="mx-auto max-w-md space-y-3.5">
              <div>
                <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                  <Compass className="h-2.5 w-2.5" /> {assignment.subject || "General"}
                </span>
                <h3 className="mt-1.5 text-sm font-bold text-zinc-900 dark:text-zinc-50">
                  {assignment.title}
                </h3>
                {assignment.description && (
                  <p className="mt-1 text-xs text-zinc-500 leading-relaxed dark:text-zinc-400">
                    {assignment.description}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-zinc-50 pt-3 dark:border-zinc-900/50">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-50 text-zinc-400 dark:bg-zinc-900">
                    <IndianRupee className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Budget Scope</p>
                    <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      ₹{assignment.budget_min ?? 0} - ₹{assignment.budget_max ?? 0}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-50 text-zinc-400 dark:bg-zinc-900">
                    <Calendar className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Target Date</p>
                    <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 truncate">
                      {renderDeadline()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Messages Feed Viewport */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="mx-auto max-w-md space-y-3">
          
          {messages?.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-4xl mb-2">👋</div>
              <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Say hi to {peerProfile?.display_name?.split(" ")[0] ?? "them"}!</p>
              <p className="text-[11px] text-zinc-400 max-w-[240px] mt-1 dark:text-zinc-500">
                Discuss implementation milestones, task assets, or submit custom price offers directly here.
              </p>
            </div>
          )}

          {grouped.map(({ date, msgs }) => (
            <div key={date} className="space-y-1.5">
              <DateDivider date={date} />
              {msgs.map((m, i) => {
                const mine = m.sender_id === user?.id;
                const time = format(new Date(m.created_at), "h:mm a");

                if (m.offer_amount) {
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"} my-3`}>
                      <div className={`w-full max-w-[280px] rounded-2xl p-4 border text-left shadow-xs ${
                        mine ? "bg-zinc-900 border-zinc-800 text-white dark:bg-zinc-900 dark:border-zinc-800" : "bg-white border-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-50"
                      }`}>
                        <p className={`text-[9px] font-bold uppercase tracking-wider mb-1 ${mine ? "text-zinc-400" : "text-zinc-500"}`}>
                          {mine ? "Your proposed offer" : "Negotiation offer received"}
                        </p>
                        <div className={`flex items-center text-2xl font-black ${mine ? "text-white" : "text-zinc-900 dark:text-white"}`}>
                          <IndianRupee className="h-5 w-5 stroke-[2.5]" />{m.offer_amount}
                        </div>
                        <p className="text-[9px] opacity-60 mt-1">{time}</p>
                        {!mine && (
                          <Button size="sm" className="mt-3 w-full bg-zinc-950 text-white hover:bg-zinc-900 rounded-xl font-bold text-xs dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-100" onClick={() => acceptOffer(m)}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Accept Assignment Offer
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={m.id} className={`flex w-full ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[82%] space-y-0.5`}>
                      <div className={`rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                        mine
                          ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                          : "bg-white text-zinc-800 border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800/80 dark:text-zinc-200"
                      }`}>
                        {m.content}
                      </div>
                      <p className={`text-[8px] font-medium text-zinc-400 dark:text-zinc-600 px-1 ${mine ? "text-right" : "text-left"}`}>
                        {time}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>

      {/* Persistent Message Input Actions Deck */}
      <div className="border-t border-zinc-100 bg-white p-3 dark:border-zinc-900 dark:bg-zinc-950">
        <div className="mx-auto max-w-md">
          {showOffer && (
            <div className="mb-2 flex items-center gap-2 bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-2 dark:bg-zinc-900 dark:border-zinc-800">
              <IndianRupee className="h-4 w-4 text-zinc-500 shrink-0" />
              <Input
                type="number" 
                placeholder="0.00"
                value={offer} 
                onChange={(e) => setOffer(e.target.value)}
                className="border-none bg-transparent p-0 h-auto focus-visible:ring-0 font-bold text-zinc-900 text-sm dark:text-white shadow-none"
                inputMode="numeric" 
                autoFocus
              />
              <button onClick={() => { setShowOffer(false); setOffer(""); }} className="text-xs font-bold text-zinc-400 hover:text-zinc-600 px-1">✕</button>
            </div>
          )}
          
          <form onSubmit={send} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowOffer((v) => !v)}
              className={`shrink-0 h-10 w-10 rounded-xl flex items-center justify-center transition ${
                showOffer ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900" : "bg-zinc-50 text-zinc-500 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-400"
              }`}
              aria-label="Make offer"
            >
              <IndianRupee className="h-4 w-4" />
            </button>
            <Input
              ref={inputRef}
              placeholder="Type your message..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="flex-1 h-10 rounded-xl bg-zinc-50/60 border-none text-xs focus-visible:ring-1 focus-visible:ring-zinc-200 dark:bg-zinc-900 dark:focus-visible:ring-zinc-800 shadow-none"
            />
            <Button
              type="submit"
              disabled={!text.trim() && !offer}
              size="icon"
              className="h-10 w-10 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 shrink-0 disabled:opacity-30 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-100 shadow-none"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>

    </div>
  );
}
