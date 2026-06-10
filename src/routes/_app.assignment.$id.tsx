import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, IndianRupee, Star, Clock, MessageCircle,
  CheckCircle2, Plus, Minus, Wallet, Upload, FileText,
  Lock, Loader2, Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/assignment/$id")({
  component: AssignmentPage,
});

interface BidRow {
  id: string; amount: number; message: string | null; status: string;
  created_at: string; writer_id: string;
  writer: { display_name: string; avatar_url: string | null; rating: number; jobs_completed: number } | null;
}

function InitialsAvatar({ name, size = 40 }: { name: string; size?: number }) {
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

function AssignmentPage() {
  const { id } = Route.useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: assignment, isLoading } = useQuery({
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
  const isWriter = true; // Anyone can bid
  const myBid = bids?.find((b) => b.writer_id === user?.id);
  const hasAccepted = !!assignment?.accepted_bid_id;
  const deadline = assignment ? new Date(assignment.deadline) : null;
  const isUrgent = deadline ? deadline.getTime() - Date.now() < 24 * 60 * 60 * 1000 : false;

  const [bidAmount, setBidAmount] = useState(myBid ? String(myBid.amount) : "");
  const [bidMessage, setBidMessage] = useState(myBid?.message ?? "");
  const [placing, setPlacing] = useState(false);

  const adjust = (delta: number) =>
    setBidAmount((v) => String(Math.max(1, (parseInt(v || "0") || 0) + delta)));

  const placeBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !assignment) return;
    const amt = parseInt(bidAmount);
    if (!amt || amt < 1) return toast.error("Enter a valid amount");
    setPlacing(true);
    const { error } = await supabase.from("bids").upsert({
      assignment_id: id,
      writer_id: user.id,
      amount: amt,
      message: bidMessage || null,
      status: "pending",
    }, { onConflict: "assignment_id,writer_id" });
    setPlacing(false);
    if (error) return toast.error(error.message);
    toast.success(myBid ? "Bid updated! 🔄" : "Bid placed! 🚀");
    qc.invalidateQueries({ queryKey: ["bids", id] });
  };

  const accept = async (bid: BidRow) => {
    const { error } = await supabase.from("bids").update({ status: "accepted" }).eq("id", bid.id);
    if (error) return toast.error(error.message);
    await supabase.from("assignments").update({ status: "in_progress", accepted_bid_id: bid.id }).eq("id", id);
    // Reject other bids
    await supabase.from("bids").update({ status: "rejected" })
      .eq("assignment_id", id).neq("id", bid.id);
    // Notify the writer
    await supabase.from("notifications").insert({
      user_id: bid.writer_id,
      title: "Bid accepted! 🎉",
      body: `Your bid of ₹${bid.amount} was accepted for "${assignment?.title}". The student will pay now.`,
      link: `/assignment/${id}`,
    });
    toast.success("Bid accepted! Chat with the writer.");
    qc.invalidateQueries({ queryKey: ["bids", id] });
    qc.invalidateQueries({ queryKey: ["assignment", id] });
    navigate({ to: "/chat/$id/$peer", params: { id, peer: bid.writer_id } });
  };

  const reject = async (bid: BidRow) => {
    await supabase.from("bids").update({ status: "rejected" }).eq("id", bid.id);
    qc.invalidateQueries({ queryKey: ["bids", id] });
    toast.success("Bid rejected");
  };

  if (isLoading) return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  if (!assignment) return (
    <div className="p-8 text-center">
      <p className="text-muted-foreground">Assignment not found.</p>
    </div>
  );

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="bg-gradient-hero px-4 pt-8 pb-16 text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="relative">
          <button onClick={() => navigate({ to: "/feed" })}
            className="mb-4 text-primary-foreground/80 hover:text-white flex items-center gap-1.5 text-sm transition">
            <ArrowLeft className="h-4 w-4" /> Feed
          </button>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs font-bold bg-white/20 backdrop-blur px-3 py-1 rounded-full">
              {assignment.subject}
            </span>
            {isUrgent && (
              <span className="text-xs font-bold bg-red-400/30 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                <Zap className="h-3 w-3" />URGENT
              </span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
              assignment.status === "open" ? "bg-green-400/25 text-white" : "bg-white/20 text-white/80"
            }`}>
              {assignment.status.replace("_", " ")}
            </span>
          </div>
          <h1 className="text-2xl font-bold leading-tight">{assignment.title}</h1>
          <div className="flex items-center gap-4 mt-3 text-sm text-primary-foreground/80">
            <span className="flex items-center gap-1 font-bold text-white">
              <IndianRupee className="h-4 w-4" />{assignment.budget_min}–{assignment.budget_max}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {deadline ? formatDistanceToNow(deadline, { addSuffix: true }) : "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-10 relative z-10 space-y-4">
        {/* Description card */}
        <div className="rounded-3xl bg-card border border-border shadow-card p-5">
          <div className="flex items-center gap-3 mb-3">
            {assignment.student && (
              <InitialsAvatar name={assignment.student.display_name} size={36} />
            )}
            <div>
              <p className="font-semibold text-sm">{assignment.student?.display_name ?? "Student"}</p>
              <p className="text-xs text-muted-foreground">Posted {assignment.created_at ? formatDistanceToNow(new Date(assignment.created_at), { addSuffix: true }) : ""}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {assignment.description}
          </p>
        </div>

        {/* Bids section */}
        <div>
          <h2 className="font-bold text-base flex items-center justify-between mb-3">
            <span>Bids</span>
            <span className="text-sm font-normal text-muted-foreground">{bids?.length ?? 0} offers</span>
          </h2>

          {bids?.length === 0 && (
            <div className="text-center py-10 bg-card rounded-3xl border border-dashed border-border">
              <div className="text-4xl mb-2">🙋</div>
              <p className="text-sm font-semibold">No bids yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                {isWriter ? "Be the first to bid!" : "Writers will bid soon!"}
              </p>
            </div>
          )}

          <div className="space-y-3">
            {bids?.map((b) => (
              <div key={b.id} className={`rounded-2xl bg-card p-4 shadow-card border transition-all ${
                b.status === "accepted" ? "border-success/50 ring-2 ring-success/20" :
                b.status === "rejected" ? "border-border opacity-50" : "border-border"
              }`}>
                <div className="flex items-start gap-3">
                  <InitialsAvatar name={b.writer?.display_name ?? "W"} size={44} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{b.writer?.display_name}</p>
                      {b.status === "accepted" && (
                        <span className="text-xs text-success flex items-center gap-1 font-medium">
                          <CheckCircle2 className="h-3 w-3" />Accepted
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <Star className="h-3 w-3 fill-warning text-warning" />
                      {Number(b.writer?.rating ?? 0).toFixed(1)}
                      <span>·</span>
                      <span>{b.writer?.jobs_completed ?? 0} jobs</span>
                    </div>
                    {b.message && (
                      <p className="text-sm text-foreground/80 mt-1.5 leading-relaxed">{b.message}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-lg text-primary flex items-center justify-end">
                      <IndianRupee className="h-4 w-4" />{b.amount}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(b.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>

                {/* Owner actions */}
                {isOwner && b.status === "pending" && !hasAccepted && (
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" className="flex-1 bg-gradient-primary rounded-xl" onClick={() => accept(b)}>
                      Accept
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 rounded-xl" onClick={() => reject(b)}>
                      Reject
                    </Button>
                    <Link to="/chat/$id/$peer" params={{ id, peer: b.writer_id }}>
                      <Button size="sm" variant="secondary" className="rounded-xl px-3">
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                )}

                {/* Writer chat */}
                {!isOwner && b.writer_id === user?.id && (
                  <Link to="/chat/$id/$peer" params={{ id, peer: assignment.student_id }} className="block mt-3">
                    <Button size="sm" variant="secondary" className="w-full rounded-xl">
                      <MessageCircle className="h-4 w-4 mr-1.5" />Chat with student
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Bid form (writers only, assignment open) ── */}
        {!isOwner && isWriter && assignment.status === "open" && (
          <div className="rounded-3xl bg-card border border-border shadow-card p-5">
            <h3 className="font-bold text-base mb-1">
              {myBid ? "Update your bid" : "Place a bid"}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Budget: ₹{assignment.budget_min}–{assignment.budget_max}
            </p>
            <form onSubmit={placeBid} className="space-y-3">
              <div className="flex items-center gap-2">
                <Button type="button" size="icon" variant="outline" onClick={() => adjust(-10)} className="rounded-xl shrink-0">
                  <Minus className="h-4 w-4" />
                </Button>
                <div className="relative flex-1">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number" required min={1}
                    placeholder="Your price"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    className="pl-9 text-center font-bold text-lg rounded-xl"
                    inputMode="numeric"
                  />
                </div>
                <Button type="button" size="icon" variant="outline" onClick={() => adjust(10)} className="rounded-xl shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground text-center">Tap − / + to adjust by ₹10</p>
              <Textarea
                rows={2}
                placeholder="Quick pitch — why should they pick you? (optional)"
                value={bidMessage}
                onChange={(e) => setBidMessage(e.target.value)}
                className="rounded-xl resize-none"
              />
              <Button type="submit" disabled={placing} className="w-full h-12 font-semibold bg-gradient-primary rounded-2xl">
                {placing
                  ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Placing…</span>
                  : myBid ? "Update bid" : "Submit bid 🚀"
                }
              </Button>
            </form>
          </div>
        )}

        {/* ── Post-accept section ── */}
        {assignment.status !== "open" && assignment.accepted_bid_id && (
          <PostAcceptSection
            assignmentId={id}
            assignment={assignment}
            userId={user?.id}
          />
        )}

        {isOwner && assignment.status === "open" && (
          <p className="text-center text-xs text-muted-foreground py-2">
            This is your assignment. Sign in as a writer to bid.
          </p>
        )}
      </div>
    </div>
  );
}

interface AssignmentLite {
  student_id: string; accepted_bid_id: string | null; title: string;
}

function PostAcceptSection({ assignmentId, assignment, userId }: {
  assignmentId: string; assignment: AssignmentLite; userId?: string;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: bid } = useQuery({
    queryKey: ["bid", assignment.accepted_bid_id],
    enabled: !!assignment.accepted_bid_id,
    queryFn: async () => {
      const { data } = await supabase.from("bids").select("*").eq("id", assignment.accepted_bid_id!).single();
      return data;
    },
  });

  const { data: payment } = useQuery({
    queryKey: ["payment", assignmentId],
    staleTime: 0,
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("*").eq("assignment_id", assignmentId).maybeSingle();
      return data;
    },
  });

  const { data: file } = useQuery({
    queryKey: ["assignment-file", assignmentId],
    staleTime: 0,
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data } = await supabase.from("assignment_files").select("*").eq("assignment_id", assignmentId).maybeSingle();
      return data;
    },
  });

  if (!bid) return null;
  const isStudent = userId === assignment.student_id;
  const isWriter  = userId === bid.writer_id;

  const uploadAssignmentFile = async (f: File) => {
    if (!userId) return;
    if (f.size > 25 * 1024 * 1024) return toast.error("File must be under 25 MB");
    setUploading(true);
    try {
      const path = `${userId}/assignment-${assignmentId}-${Date.now()}-${f.name}`;
      const { error: upErr } = await supabase.storage
        .from("assignment-files").upload(path, f, { upsert: true });
      if (upErr) throw upErr;

      const { error } = await supabase.from("assignment_files").upsert({
        assignment_id: assignmentId,
        bid_id: bid.id,
        writer_id: userId,
        storage_path: path,
        file_name: f.name,
        file_size: f.size,
        released: false,
      }, { onConflict: "bid_id" });
      if (error) throw error;

      // Notify student + admin
      await supabase.from("notifications").insert([
        { user_id: assignment.student_id, title: "Writer uploaded your file! 📄", body: "Admin is reviewing. You'll be notified when it's released.", link: `/payment/${assignmentId}` },
      ]);
      const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      if (admins?.length) {
        await supabase.from("notifications").insert(
          admins.map((a) => ({ user_id: a.user_id, title: "File ready to release 📤", body: assignment.title, link: "/admin" }))
        );
      }
      toast.success("File uploaded! Locked until admin releases it.");
      qc.invalidateQueries({ queryKey: ["assignment-file", assignmentId] });
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-3xl bg-card border border-border shadow-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
        <p className="font-bold">Bid accepted · ₹{bid.amount}</p>
      </div>

      {/* Student: Pay now button */}
      {isStudent && (
        <Link to="/payment/$id" params={{ id: assignmentId }}>
          <Button className="w-full h-12 font-semibold bg-gradient-primary rounded-2xl shadow-soft">
            <Wallet className="h-5 w-5 mr-2" />
            {!payment && "Pay now"}
            {payment?.status === "awaiting_payment" && "Continue payment →"}
            {payment?.status === "payment_received" && "Payment confirmed — waiting for file"}
            {payment?.status === "file_delivered" && "Download your file 📄"}
          </Button>
        </Link>
      )}

      {/* Writer: Upload file */}
      {isWriter && (
        <div className="space-y-2">
          <div className={`text-xs px-3 py-2 rounded-xl font-medium flex items-center gap-2 ${
            !payment ? "bg-warning/10 text-warning" :
            payment.status === "awaiting_payment" ? "bg-warning/10 text-warning" :
            payment.status === "payment_received" ? "bg-success/10 text-success" :
            "bg-muted text-muted-foreground"
          }`}>
            <Clock className="h-3.5 w-3.5 shrink-0" />
            Payment: <strong className="ml-1">{payment?.status?.replace(/_/g, " ") ?? "not started"}</strong>
          </div>

          <input
            ref={fileRef}
            type="file"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadAssignmentFile(f);
              if (e.target) e.target.value = "";
            }}
          />
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            variant={file ? "secondary" : "outline"}
            className="w-full rounded-2xl"
          >
            {uploading
              ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Uploading…</span>
              : <span className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  {file ? "Replace uploaded file" : "Upload completed assignment"}
                </span>
            }
          </Button>

          {file && (
            <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2 text-xs text-muted-foreground">
              {file.released
                ? <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                : <Lock className="h-3.5 w-3.5 shrink-0" />}
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{file.file_name}</span>
              <span className="ml-auto shrink-0 text-primary font-medium">
                {file.released ? "Released ✓" : "Locked"}
              </span>
            </div>
          )}

          {payment?.status === "file_delivered" && (
            <div className="bg-success/10 text-success text-xs px-3 py-2.5 rounded-xl font-medium">
              🎉 Payment released! The owner will send ₹{payment.writer_payout} to your UPI.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
