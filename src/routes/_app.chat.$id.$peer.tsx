import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, IndianRupee, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import { UserProfileModal } from "@/components/UserProfileModal";

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
  const colors = [
    "bg-zinc-600 dark:bg-zinc-500",
    "bg-zinc-700 dark:bg-zinc-400",
    "bg-slate-600 dark:bg-slate-500",
    "bg-neutral-600 dark:bg-neutral-500",
    "bg-stone-600 dark:bg-stone-500",
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`${color} rounded-full flex items-center justify-center text-white font-semibold shrink-0`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials}
    </div>
  );
}

function DateDivider({ date }: { date: string }) {
  const d = new Date(date);
  const label = isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : format(d, "MMM d, yyyy");
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-900" />
      <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider px-2">{label}</span>
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
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [autoRespond, setAutoRespond] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  
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
      const { data } = await supabase.from("assignments").select("title,status,student_id").eq("id", id).single();
      return data;
    },
  });

  const isStudent = user?.id === assignment?.student_id;

  const suggestions = isStudent
    ? [
        "Hi! Are you experienced in this subject? 📚",
        "Can you guarantee plagiarism-free work? 🛡️",
        "Can you deliver before the deadline? ⏰",
        "Let's finalize at this price! 🤝",
        "Please send some previous work samples 📄",
      ]
    : [
        "Hi! Yes, I can assist you with this. ✍️",
        "I have extensive experience in this topic! 🌟",
        "Please share the rubric/instructions. 📋",
        "I'll deliver original, high-quality work on time. ✅",
        "Is the current budget flexible? 💰",
      ];

  const generateAutoReply = (userText: string): string => {
    const t = userText.toLowerCase();
    if (t.includes("plagiarism") || t.includes("original") || t.includes("cop")) {
      return "Absolutely! I guarantee 100% original work. I always run a thorough Turnitin plagiarism check before delivering! 🛡️";
    }
    if (t.includes("deadline") || t.includes("time") || t.includes("when")) {
      return "Yes, I will definitely deliver it well before the deadline, probably a few hours early so you can review it first! ⏰";
    }
    if (t.includes("price") || t.includes("budget") || t.includes("negotiate") || t.includes("cost")) {
      return "I can offer a 10% discount on this assignment if we finalize the details today! Let's get started. 🤝";
    }
    if (t.includes("sample") || t.includes("work") || t.includes("previous")) {
      return "Sure! I've worked on similar essays and case studies before. I'll search my drive and paste a quick sample here in a second. 📄";
    }
    if (t.includes("rubric") || t.includes("instructions") || t.includes("guideline")) {
      return "Yes, please upload them! I am checking the topic brief right now. It looks very straightforward, I can handle this easily! 📋";
    }
    if (t.includes("hi") || t.includes("hello") || t.includes("hey")) {
      return isStudent 
        ? "Hello there! Yes, I can assist you with this assignment. What specific style guide or requirements do you have? ✍️"
        : "Hi! Yes, I saw your bid and I'm very interested. Let's discuss the core requirements. 😊";
    }
    return "That sounds perfect! Let me review all details and get back to you with the next steps. 👍";
  };

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
  }, [messages, isTyping]);

  const sendDirectMessage = async (contentStr: string) => {
    if (!user) return;
    
    const trimmed = contentStr.trim();
    if (trimmed.length > 2000) {
      return toast.error("Message exceeds the 2000 character limit.");
    }
    if (!trimmed) return;

    const payload = {
      assignment_id: id,
      sender_id: user.id,
      receiver_id: peer,
      content: trimmed,
      offer_amount: null,
    };
    const { error } = await supabase.from("messages").insert(payload);
    if (error) return toast.error(error.message);
    
    qc.invalidateQueries({ queryKey: ["messages", id, peer] });

    if (autoRespond) {
      setIsTyping(true);
      setTimeout(async () => {
        const replyText = generateAutoReply(trimmed);
        const autoPayload = {
          assignment_id: id,
          sender_id: peer,
          receiver_id: user.id,
          content: replyText,
          offer_amount: null,
        };
        await supabase.from("messages").insert(autoPayload);
        setIsTyping(false);
        qc.invalidateQueries({ queryKey: ["messages", id, peer] });
      }, 1500);
    }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || (!text.trim() && !offer)) return;
    
    const trimmedText = text.trim();
    if (trimmedText.length > 2000) {
      return toast.error("Message exceeds the 2000 character limit.");
    }

    let parsedOffer: number | null = null;
    if (offer) {
      const amt = parseInt(offer);
      if (isNaN(amt) || amt <= 0) {
        return toast.error("Please enter a valid positive offer amount.");
      }
      if (amt > 10000000) {
        return toast.error("Offer amount is too high.");
      }
      parsedOffer = amt;
    }

    const messageContent = trimmedText || `New offer: ₹${parsedOffer}`;
    const payload = {
      assignment_id: id,
      sender_id: user.id,
      receiver_id: peer,
      content: messageContent,
      offer_amount: parsedOffer,
    };
    const { error } = await supabase.from("messages").insert(payload);
    if (error) return toast.error(error.message);
    
    const sentText = trimmedText;
    setText(""); setOffer(""); setShowOffer(false);
    qc.invalidateQueries({ queryKey: ["messages", id, peer] });
    inputRef.current?.focus();

    if (autoRespond && sentText) {
      setIsTyping(true);
      setTimeout(async () => {
        const replyText = generateAutoReply(sentText);
        const autoPayload = {
          assignment_id: id,
          sender_id: peer,
          receiver_id: user.id,
          content: replyText,
          offer_amount: null,
        };
        await supabase.from("messages").insert(autoPayload);
        setIsTyping(false);
        qc.invalidateQueries({ queryKey: ["messages", id, peer] });
      }, 1500);
    }
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

  return (
    <div className="flex flex-col h-[100dvh] bg-zinc-50/50 dark:bg-zinc-950" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-lg border-b border-zinc-100 dark:border-zinc-900 sticky top-0 z-20 shadow-xs">
        <Link to="/assignment/$id" params={{ id }}
          className="h-9 w-9 rounded-xl border border-zinc-100 dark:border-zinc-800 flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-800 transition shrink-0 text-zinc-600 dark:text-zinc-300">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        {peerProfile ? (
          <button
            type="button"
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-3 text-left focus:outline-none hover:opacity-85 transition flex-1 min-w-0"
            title="View Profile"
          >
            <Avatar name={peerProfile.display_name} size={38} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate leading-tight text-zinc-900 dark:text-zinc-50 hover:text-zinc-700 transition">{peerProfile.display_name}</p>
              {assignment && <p className="text-[11px] text-muted-foreground truncate font-medium">{assignment.title}</p>}
            </div>
          </button>
        ) : (
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate text-sm leading-tight">Chat</p>
            {assignment && <p className="text-xs text-muted-foreground truncate">{assignment.title}</p>}
          </div>
        )}
        <a href={`/assignment/${id}`}
          className="shrink-0 text-xs text-zinc-900 bg-zinc-100 border border-zinc-200/50 dark:text-zinc-100 dark:bg-zinc-900 dark:border-zinc-800 px-3.5 py-1.5 rounded-xl font-medium hover:bg-zinc-200 dark:hover:bg-zinc-800 transition">
          View task
        </a>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 bg-zinc-50/20 dark:bg-zinc-950/20 scrollbar-none space-y-4">
        {messages?.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-12">
            <div className="text-5xl animate-float">👋</div>
            <div>
              <p className="font-semibold text-zinc-900 dark:text-zinc-50">Say hi to {peerProfile?.display_name?.split(" ")[0] ?? "them"}!</p>
              <p className="text-xs text-muted-foreground max-w-xs mt-1 leading-relaxed">Discuss the assignment, specify rules, ask questions, or send a dynamic budget offer.</p>
            </div>
          </div>
        )}
        {grouped.map(({ date, msgs }) => (
          <div key={date}>
            <DateDivider date={date} />
            <div className="flex flex-col">
              {msgs.map((m, i) => {
                const mine = m.sender_id === user?.id;
                const nextSame = i < msgs.length - 1 && msgs[i + 1].sender_id === m.sender_id;
                const prevSame = i > 0 && msgs[i - 1].sender_id === m.sender_id;
                const time = format(new Date(m.created_at), "h:mm a");

                let roundedClasses = "";
                if (mine) {
                  if (prevSame && nextSame) {
                    roundedClasses = "rounded-[18px_6px_6px_18px]";
                  } else if (prevSame) {
                    roundedClasses = "rounded-[18px_6px_18px_18px]";
                  } else if (nextSame) {
                    roundedClasses = "rounded-[18px_18px_6px_18px]";
                  } else {
                    roundedClasses = "rounded-2xl";
                  }
                } else {
                  if (prevSame && nextSame) {
                    roundedClasses = "rounded-[6px_18px_18px_6px]";
                  } else if (prevSame) {
                    roundedClasses = "rounded-[6px_18px_18px_18px]";
                  } else if (nextSame) {
                    roundedClasses = "rounded-[18px_18px_18px_6px]";
                  } else {
                    roundedClasses = "rounded-2xl";
                  }
                }

                if (m.offer_amount) {
                  return (
                    <div key={m.id} className={`flex items-start gap-2.5 ${mine ? "justify-end" : "justify-start"} ${prevSame ? "mt-2" : "mt-4"} mb-1`}>
                      {!mine && (
                        <div className="shrink-0 pt-1">
                          {!nextSame && peerProfile
                            ? <Avatar name={peerProfile.display_name} size={28} />
                            : <div className="w-7" />}
                        </div>
                      )}
                      <div className={`max-w-[75%] rounded-2xl p-5 border shadow-sm transition hover:shadow-md ${
                        mine 
                          ? "bg-zinc-900 border-zinc-850 text-zinc-50 dark:bg-zinc-900 dark:border-zinc-800" 
                          : "bg-white border-zinc-150 dark:bg-zinc-900 dark:border-zinc-800 text-zinc-900 dark:text-zinc-50"
                      }`}>
                        <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${mine ? "text-zinc-400" : "text-muted-foreground"}`}>
                          {mine ? "Your offer" : "Offer received"}
                        </p>
                        <div className={`flex items-center text-2xl font-extrabold ${mine ? "text-zinc-50" : "text-zinc-900 dark:text-zinc-50"}`}>
                          <IndianRupee className="h-5.5 w-5.5 shrink-0 text-muted-foreground mr-0.5" />{m.offer_amount}
                        </div>
                        <p className={`text-[10px] mt-2 ${mine ? "text-zinc-500" : "text-muted-foreground"}`}>{time}</p>
                        {!mine && (
                          <Button size="sm" className="mt-4 w-full bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200 rounded-xl font-semibold border border-transparent shadow-xs" onClick={() => acceptOffer(m)}>
                            <CheckCircle2 className="h-4 w-4 mr-1.5" />Accept offer
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={m.id} className={`flex items-end gap-2.5 ${mine ? "justify-end" : "justify-start"} ${prevSame ? "mt-1.5" : "mt-4"}`}>
                    {!mine && (
                      <div className="shrink-0 mb-0.5">
                        {!nextSame && peerProfile
                          ? <Avatar name={peerProfile.display_name} size={28} />
                          : <div className="w-7" />}
                      </div>
                    )}
                    <div className={`flex flex-col ${mine ? "items-end" : "items-start"} max-w-[72%]`}>
                      <div className={`px-4 py-2.5 text-[14px] leading-relaxed shadow-xs border transition-all ${roundedClasses} ${
                        mine
                          ? "bg-zinc-900 border-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-950 font-normal"
                          : "bg-white border-zinc-150 text-zinc-900 dark:bg-zinc-900 dark:border-zinc-850 dark:text-zinc-100"
                      }`}>
                        {m.content}
                      </div>
                      {!nextSame && <p className="text-[10px] text-muted-foreground mt-1 px-1">{time}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex items-end gap-2.5 mt-2">
            <div className="shrink-0 mb-0.5">
              {peerProfile ? <Avatar name={peerProfile.display_name} size={28} /> : <div className="w-7" />}
            </div>
            <div className="bg-white border border-zinc-150 dark:bg-zinc-900 dark:border-zinc-850 text-zinc-900 dark:text-zinc-100 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1.5 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Suggestions and Input Footer */}
      <div className="bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-850 px-3 pt-3.5 pb-4">
        {/* Toggle & Title Header */}
        <div className="flex items-center justify-between mb-3 px-1 flex-wrap gap-2">
          <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-zinc-400 animate-pulse" />
            Quick Auto Messages
          </span>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">Auto-Response Simulation</span>
            <div className="relative">
              <input type="checkbox" checked={autoRespond} onChange={(e) => setAutoRespond(e.target.checked)} className="sr-only" />
              <div className={`w-8 h-4.5 rounded-full transition-colors ${autoRespond ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-200 dark:bg-zinc-800"}`} />
              <div className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white dark:bg-zinc-950 transition-transform ${autoRespond ? "transform translate-x-3.5" : ""}`} />
            </div>
          </label>
        </div>

        {/* Suggestion Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-2.5 scrollbar-none snap-x touch-pan-x -mx-1 px-1">
          {suggestions.map((suggestion, idx) => (
            <button key={idx} type="button" onClick={() => sendDirectMessage(suggestion)}
              className="snap-start text-[11px] font-medium border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-3.5 py-1.5 rounded-full whitespace-nowrap transition-all shadow-xs hover:scale-[1.02] active:scale-[0.98]">
              {suggestion}
            </button>
          ))}
        </div>

        {showOffer && (
          <div className="mb-3 flex items-center gap-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-3 py-2.5">
            <IndianRupee className="h-4.5 w-4.5 text-zinc-600 dark:text-zinc-400 shrink-0" />
            <Input type="number" placeholder="Enter offer amount" value={offer} onChange={(e) => setOffer(e.target.value)}
              className="border-none bg-transparent p-0 h-auto focus-visible:ring-0 font-bold text-zinc-900 dark:text-zinc-50 text-base" inputMode="numeric" autoFocus />
            <button onClick={() => { setShowOffer(false); setOffer(""); }} className="text-xs text-muted-foreground hover:text-foreground px-2">✕</button>
          </div>
        )}
        <form onSubmit={send} className="flex items-center gap-2">
          <button type="button" onClick={() => setShowOffer((v) => !v)}
            className={`shrink-0 h-10 w-10 rounded-2xl flex items-center justify-center transition border ${
              showOffer 
                ? "bg-zinc-900 text-zinc-50 border-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 dark:border-zinc-100 shadow-sm" 
                : "bg-zinc-50 text-zinc-600 border-zinc-200/60 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800 dark:hover:bg-zinc-800"
            }`}
            aria-label="Make offer">
            <IndianRupee className="h-4 w-4" />
          </button>
          <Input ref={inputRef} placeholder="Type a message..." value={text} onChange={(e) => setText(e.target.value)} maxLength={2000}
            className="flex-1 h-10 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-850 focus-visible:ring-1 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-700" />
          <Button type="submit" disabled={!text.trim() && !offer} size="icon"
            className="h-10 w-10 rounded-2xl bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200 shadow-sm shrink-0 disabled:opacity-40 border border-transparent">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {/* User Profile Modal */}
      <UserProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} userId={peer} />
    </div>
  );
}
