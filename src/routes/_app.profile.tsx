import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { 
  ArrowLeft, Send, Loader2, Calendar, IndianRupee, 
  ChevronDown, ChevronUp, FileText, Compass, Info 
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/chat/$id/$peer")({
  component: ChatRoomPage,
});

function ChatRoomPage() {
  const { id: assignmentId, peer: peerId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [typedMessage, setTypedMessage] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. CRASH FIX: Fetch assignment details by safely mapping through accepted_bid_id
  const { data: workspace, isLoading: loadingWorkspace } = useQuery({
    queryKey: ["chat-workspace", assignmentId, peerId],
    enabled: !!user,
    queryFn: async () => {
      // Fetch assignment and peer profile details securely
      const [assignmentRes, peerRes] = await Promise.all([
        supabase
          .from("assignments")
          .select(`
            *,
            accepted_bid:bids!assignments_accepted_bid_id_fkey (
              id,
              writer_id,
              amount
            )
          `)
          .eq("id", assignmentId)
          .single(),
        supabase
          .from("profiles")
          .select("display_name, role")
          .eq("id", peerId)
          .single()
      ]);

      if (assignmentRes.error) throw assignmentRes.error;
      if (peerRes.error) throw peerRes.error;

      return {
        assignment: assignmentRes.data,
        peer: peerRes.data
      };
    }
  });

  // 2. Fetch Chat Messages Stream
  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ["chat-messages", assignmentId],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("assignment_id", assignmentId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    }
  });

  // 3. Realtime Subscription Pipeline setup
  useEffect(() => {
    if (!user || !assignmentId) return;

    const channel = supabase
      .channel(`room:${assignmentId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `assignment_id=eq.${assignmentId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["chat-messages", assignmentId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [assignmentId, user]);

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, showDetails]);

  // 4. Message Dispatch Mutation Loop
  const sendMessageMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!user) return;
      const { error } = await supabase.from("messages").insert({
        assignment_id: assignmentId,
        sender_id: user.id,
        receiver_id: peerId,
        content: text.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTypedMessage("");
      queryClient.invalidateQueries({ queryKey: ["chat-messages", assignmentId] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to deliver message");
    }
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedMessage.trim() || sendMessageMutation.isPending) return;
    sendMessageMutation.mutate(typedMessage);
  };

  if (loadingWorkspace || loadingMessages) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-zinc-950">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  const assignment = workspace?.assignment;
  const peer = workspace?.peer;

  return (
    <div className="flex h-screen flex-col bg-zinc-50/60 dark:bg-zinc-950">
      
      {/* Premium Header Utility Stack */}
      <header className="sticky top-0 z-40 border-b border-zinc-100 bg-white/90 backdrop-blur-md dark:border-zinc-900 dark:bg-zinc-950/90">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate({ to: "/chats" })}
              className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 truncate">
                {peer?.display_name || "Workspace Room"}
              </h1>
              <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider dark:text-zinc-500">
                {peer?.role}
              </p>
            </div>
          </div>

          {/* Action Trigger button to view assignment details safely */}
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
                  <Compass className="h-2.5 w-2.5" /> {assignment.subject}
                </span>
                <h3 className="mt-1.5 text-sm font-bold text-zinc-900 dark:text-zinc-50">
                  {assignment.title}
                </h3>
                <p className="mt-1 text-xs text-zinc-500 leading-relaxed dark:text-zinc-400">
                  {assignment.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-zinc-50 pt-3 dark:border-zinc-900/50">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-50 text-zinc-400 dark:bg-zinc-900">
                    <IndianRupee className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Budget Range</p>
                    <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      ₹{assignment.budget_min} - ₹{assignment.budget_max}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-50 text-zinc-400 dark:bg-zinc-900">
                    <Calendar className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Target Target</p>
                    <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 truncate">
                      {new Date(assignment.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Messages Canvas Workspace Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        <div className="mx-auto max-w-md space-y-4">
          
          {/* Informational systemic header marker */}
          <div className="flex items-center justify-center gap-1.5 text-[10px] font-medium text-zinc-400 dark:text-zinc-600 py-2">
            <Info className="h-3 w-3" />
            <span>All communications are logged and secured via escrow rules</span>
          </div>

          {messages?.map((msg) => {
            const isMe = msg.sender_id === user?.id;
            return (
              <div
                key={msg.id}
                className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[85%] space-y-0.5`}>
                  <div
                    className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                      isMe
                        ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                        : "bg-white text-zinc-800 border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800/80 dark:text-zinc-200"
                    }`}
                  >
                    {msg.content}
                  </div>
                  <p className={`text-[9px] font-medium text-zinc-400 dark:text-zinc-600 px-1 ${isMe ? "text-right" : "text-left"}`}>
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>
      </div>

      {/* Persistent Message Input Controller Toolbar */}
      <div className="border-t border-zinc-100 bg-white p-4 dark:border-zinc-900 dark:bg-zinc-950">
        <form onSubmit={handleSend} className="mx-auto max-w-md flex items-center gap-2">
          <input
            type="text"
            placeholder="Type your message..."
            value={typedMessage}
            onChange={(e) => setTypedMessage(e.target.value)}
            disabled={sendMessageMutation.isPending}
            className="w-full rounded-xl border border-zinc-100 bg-zinc-50/50 px-4 py-2.5 text-xs font-medium text-zinc-800 placeholder-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
          />
          <button
            type="submit"
            disabled={!typedMessage.trim() || sendMessageMutation.isPending}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white transition-opacity disabled:opacity-30 dark:bg-zinc-50 dark:text-zinc-900"
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </form>
      </div>

    </div>
  );
}
