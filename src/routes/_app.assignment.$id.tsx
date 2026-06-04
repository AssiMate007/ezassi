import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, IndianRupee, Star, Clock, MessageCircle, CheckCircle2, Plus, Minus, Wallet, Upload, FileText, Lock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/assignment/$id")({
  component: AssignmentPage,
});

interface BidRow {
  id: string;
  amount: number;
  message: string | null;
  status: string;
  created_at: string;
  writer_id: string;
  writer: { display_name: string; avatar_url: string | null; rating: number; jobs_completed: number } | null;
}

function AssignmentPage() {
  const { id } = Route.useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: assignment } = useQuery({
    queryKey: ["assignment", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("*, student:profiles!assignments_student_id_fkey(display_name, avatar_url, rating)")
        .eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: bids } = useQuery({
    queryKey: ["bids", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bids")
        .select("*, writer:profiles!bids_writer_id_fkey(display_name, avatar_url, rating, jobs_completed)")
        .eq("assignment_id", id)
        .order("amount", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BidRow[];
    },
  });

  const isOwner = user?.id === assignment?.student_id;
  const isWriter = profile?.role === "writer";
  const myBid = bids?.find((b) => b.writer_id === user?.id);

  const [bidAmount, setBidAmount] = useState("");
  const [bidMessage, setBidMessage] = useState("");
  const [placing, setPlacing] = useState(false);

  const placeBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !assignment) return;
    setPlacing(true);
    const { error } = await supabase.from("bids").upsert({
      assignment_id: id,
      writer_id: user.id,
      amount: parseInt(bidAmount),
      message: bidMessage || null,
      status: "pending",
    }, { onConflict: "assignment_id,writer_id" });
    setPlacing(false);
    if (error) return toast.error(error.message);
    toast.success(myBid ? "Bid updated!" : "Bid placed! 🚀");
    setBidAmount(""); setBidMessage("");
    qc.invalidateQueries({ queryKey: ["bids", id] });
  };

  const accept = async (bid: BidRow) => {
    const { error } = await supabase.from("bids").update({ status: "accepted" }).eq("id", bid.id);
    if (error) return toast.error(error.message);
    await supabase.from("assignments").update({ status: "in_progress", accepted_bid_id: bid.id }).eq("id", id);
    toast.success("Bid accepted! Start chatting.");
    qc.invalidateQueries({ queryKey: ["bids", id] });
    navigate({ to: "/chat/$id/$peer", params: { id, peer: bid.writer_id } });
  };

  const reject = async (bid: BidRow) => {
    await supabase.from("bids").update({ status: "rejected" }).eq("id", bid.id);
    qc.invalidateQueries({ queryKey: ["bids", id] });
  };

  if (!assignment) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="px-4 pt-6 pb-4">
      <button onClick={() => navigate({ to: "/feed" })} className="mb-4 text-muted-foreground flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="rounded-2xl bg-card p-5 shadow-card border border-border">
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
          {assignment.subject}
        </span>
        <h1 className="mt-3 text-xl font-bold leading-snug">{assignment.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{assignment.description}</p>
        <div className="mt-4 flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 font-bold text-foreground">
            <IndianRupee className="h-4 w-4" />
            {assignment.budget_min}–{assignment.budget_max}
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {formatDistanceToNow(new Date(assignment.deadline), { addSuffix: true })}
          </div>
        </div>
      </div>

      <h2 className="mt-6 mb-3 text-lg font-bold flex items-center justify-between">
        <span>Bids</span>
        <span className="text-sm font-normal text-muted-foreground">{bids?.length ?? 0} offers</span>
      </h2>

      <div className="space-y-3">
        {bids?.length === 0 && (
          <div className="text-center py-10 text-sm text-muted-foreground">No bids yet — be the first!</div>
        )}
        {bids?.map((b) => (
          <div key={b.id} className="rounded-2xl bg-card p-4 shadow-card border border-border">
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                <AvatarFallback className="bg-gradient-primary text-primary-foreground text-sm">
                  {b.writer?.display_name?.charAt(0) ?? "W"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold truncate">{b.writer?.display_name}</p>
                  <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                    <Star className="h-3 w-3 fill-warning text-warning" />
                    {Number(b.writer?.rating ?? 0).toFixed(1)} · {b.writer?.jobs_completed ?? 0} jobs
                  </span>
                </div>
                {b.message && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{b.message}</p>}
              </div>
              <div className="text-right">
                <div className="flex items-center font-bold text-primary">
                  <IndianRupee className="h-4 w-4" />{b.amount}
                </div>
                {b.status === "accepted" && (
                  <span className="text-xs text-success flex items-center gap-1 mt-1"><CheckCircle2 className="h-3 w-3" />Accepted</span>
                )}
                {b.status === "rejected" && <span className="text-xs text-muted-foreground mt-1 block">Rejected</span>}
              </div>
            </div>
            {isOwner && b.status === "pending" && (
              <div className="flex gap-2 mt-3">
                <Button size="sm" className="flex-1 bg-gradient-primary" onClick={() => accept(b)}>Accept</Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => reject(b)}>Reject</Button>
                <Link to="/chat/$id/$peer" params={{ id, peer: b.writer_id }}>
                  <Button size="sm" variant="secondary"><MessageCircle className="h-4 w-4" /></Button>
                </Link>
              </div>
            )}
            {!isOwner && b.writer_id === user?.id && (
              <Link to="/chat/$id/$peer" params={{ id, peer: assignment.student_id }} className="block mt-3">
                <Button size="sm" variant="secondary" className="w-full"><MessageCircle className="h-4 w-4 mr-1" />Chat with student</Button>
              </Link>
            )}
          </div>
        ))}
      </div>

      {!isOwner && assignment.status === "open" && (
        <form onSubmit={placeBid} className="mt-6 rounded-2xl bg-gradient-card p-4 shadow-card border border-border space-y-3">
          <h3 className="font-bold">{myBid ? "Update your bid" : "Place your bid"}</h3>
          <div className="flex items-center gap-2">
            <Button type="button" size="icon" variant="outline" onClick={() => setBidAmount((v) => String(Math.max(1, (parseInt(v || "0") || 0) - 10)))}>
              <Minus className="h-4 w-4" />
            </Button>
            <div className="relative flex-1">
              <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="number" required min={1} placeholder="Your price" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} className="pl-8 text-center font-bold text-lg" inputMode="numeric" />
            </div>
            <Button type="button" size="icon" variant="outline" onClick={() => setBidAmount((v) => String((parseInt(v || "0") || 0) + 10))}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground text-center">Tap − or + to adjust by ₹10</p>
          <Textarea rows={2} placeholder="Quick pitch (optional)" value={bidMessage} onChange={(e) => setBidMessage(e.target.value)} />
          <Button type="submit" disabled={placing} className="w-full bg-gradient-primary">
            {placing ? "…" : myBid ? "Update bid" : "Submit bid"}
          </Button>
          <Link to="/chat/$id/$peer" params={{ id, peer: assignment.student_id }} className="block">
            <Button type="button" size="sm" variant="secondary" className="w-full">
              <MessageCircle className="h-4 w-4 mr-1" />Chat with student
            </Button>
          </Link>
        </form>
      )}

      {assignment.status !== "open" && assignment.accepted_bid_id && (
        <PostAcceptSection assignmentId={id} assignment={assignment} userId={user?.id} />
      )}

      {isOwner && (
        <p className="mt-6 text-center text-xs text-muted-foreground">
          This is your own assignment. Sign in with another account to bid on it.
        </p>
      )}
    </div>
  );
}

interface AssignmentLite { student_id: string; accepted_bid_id: string | null; title: string }

function PostAcceptSection({ assignmentId, assignment, userId }: { assignmentId: string; assignment: AssignmentLite; userId?: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: payment } = useQuery({
    queryKey: ["payment-by-bid", assignment.accepted_bid_id],
    enabled: !!assignment.accepted_bid_id,
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("*").eq("bid_id", assignment.accepted_bid_id!).maybeSingle();
      return data;
    },
  });

  const { data: bid } = useQuery({
    queryKey: ["bid", assignment.accepted_bid_id],
    enabled: !!assignment.accepted_bid_id,
    queryFn: async () => {
      const { data } = await supabase.from("bids").select("*").eq("id", assignment.accepted_bid_id!).single();
      return data;
    },
  });

  const { data: file } = useQuery({
    queryKey: ["assignment-file", assignmentId],
    queryFn: async () => {
      const { data } = await supabase.from("assignment_files").select("*").eq("assignment_id", assignmentId).maybeSingle();
      return data;
    },
  });

  if (!bid) return null;
  const isStudent = userId === assignment.student_id;
  const isWriter = userId === bid.writer_id;

  const uploadAssignmentFile = async (f: File) => {
    if (!userId) return;
    if (f.size > 25 * 1024 * 1024) return toast.error("Max 25 MB");
    setUploading(true);
    const path = `${userId}/assignment-${assignmentId}-${Date.now()}-${f.name}`;
    const { error: upErr } = await supabase.storage.from("assignment-files").upload(path, f);
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const { error } = await supabase.from("assignment_files").upsert({
      assignment_id: assignmentId,
      bid_id: bid.id,
      writer_id: userId,
      storage_path: path,
      file_name: f.name,
      file_size: f.size,
      released: false,
    }, { onConflict: "bid_id" });
    setUploading(false);
    if (error) return toast.error(error.message);
    await supabase.from("notifications").insert([
      { user_id: assignment.student_id, title: "Writer uploaded the file", body: "Locked until admin verifies payment & releases.", link: `/payment/${assignmentId}` },
    ]);
    const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
    if (admins?.length) {
      await supabase.from("notifications").insert(admins.map((a) => ({
        user_id: a.user_id, title: "Writer file ready to release", body: assignment.title, link: "/admin",
      })));
    }
    toast.success("File uploaded — locked until admin releases");
    qc.invalidateQueries({ queryKey: ["assignment-file", assignmentId] });
  };

  return (
    <div className="mt-6 space-y-3">
      <div className="rounded-2xl bg-card border border-border p-4 shadow-card">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <p className="font-semibold text-sm">Bid accepted — ₹{bid.amount}</p>
        </div>
        {isStudent && (
          <Link to="/payment/$id" params={{ id: assignmentId }}>
            <Button className="w-full bg-gradient-primary">
              <Wallet className="h-4 w-4 mr-2" />
              {payment ? (payment.status === "file_delivered" ? "View file" : "View payment") : "Pay now"}
            </Button>
          </Link>
        )}
        {isWriter && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Payment status: <strong>{payment?.status?.replace("_", " ") ?? "not started"}</strong>
            </p>
            <input ref={fileRef} type="file" hidden onChange={(e) => e.target.files?.[0] && uploadAssignmentFile(e.target.files[0])} />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading} variant="outline" className="w-full">
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Uploading…" : file ? "Replace file" : "Upload assignment"}
            </Button>
            {file && (
              <p className="text-xs flex items-center gap-1 text-muted-foreground">
                {file.released ? <CheckCircle2 className="h-3 w-3 text-success" /> : <Lock className="h-3 w-3" />}
                <FileText className="h-3 w-3" />{file.file_name} {file.released ? "(delivered)" : "(locked)"}
              </p>
            )}
            {payment?.status === "file_delivered" && (
              <p className="text-xs text-success">Released. Owner will send ₹{payment.writer_payout} to your UPI.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
