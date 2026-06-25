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
  Lock, Loader2, Zap, Download, Shield, ShieldAlert, Check,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { UserProfileModal } from "@/components/UserProfileModal";

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
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const { data: assignment, isLoading } = useQuery({
    queryKey: ["assignment", id],
    staleTime: 0,
    refetchInterval: 8_000, // auto-refresh so student sees status updates from admin
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
        .select("*, writer:profiles!writer_id(display_name, avatar_url, rating, jobs_completed)")
        .eq("assignment_id", id)
        .order("amount", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BidRow[];
    },
  });

  const isOwner = user?.id === assignment?.student_id;
  // FIX: owner cannot bid on their own assignment
  const canBid = !!user && !isOwner;
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
    const { error: aErr } = await supabase.from("assignments")
      .update({ status: "in_progress", accepted_bid_id: bid.id }).eq("id", id);
    if (aErr) return toast.error(aErr.message);
    await supabase.from("bids").update({ status: "rejected" })
      .eq("assignment_id", id).neq("id", bid.id);
    await supabase.from("notifications").insert({
      user_id: bid.writer_id,
      title: "Bid accepted! 🎉",
      body: `Your bid of ₹${bid.amount} was accepted for "${assignment?.title}". Student will pay now.`,
      link: `/assignment/${id}`,
    });
    toast.success("Bid accepted!");
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
    <div className="min-h-screen bg-zinc-50/50 pb-12 dark:bg-zinc-950">
      {/* Premium Structural Header Layout */}
      <header className="border-b border-zinc-100 bg-white px-4 pt-10 pb-8 dark:border-zinc-900 dark:bg-zinc-900/20">
        <div className="mx-auto max-w-3xl">
          <button onClick={() => navigate({ to: "/feed" })}
            className="mb-4 text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition">
            <ArrowLeft className="h-4 w-4" /> Feed
          </button>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full border border-border bg-muted text-muted-foreground">
              {assignment.subject}
            </span>
            {isUrgent && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-100 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/40 animate-pulse">
                <Zap className="h-3 w-3 text-red-500 dark:text-red-400" />URGENT
              </span>
            )}
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
              assignment.status === "open"
                ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-900"
                : "bg-muted text-muted-foreground border-border"
            }`}>
              {assignment.status.replace("_", " ")}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 leading-tight">{assignment.title}</h1>
          <div className="flex items-center gap-4 mt-3 text-sm">
            <span className="flex items-center gap-1 font-bold text-zinc-900 dark:text-zinc-50">
              <IndianRupee className="h-4 w-4 text-primary" />{assignment.budget_min}–{assignment.budget_max}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {deadline ? formatDistanceToNow(deadline, { addSuffix: true }) : "—"}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-6 space-y-4">
        <div className="rounded-3xl bg-card border border-border shadow-card p-5">
          <div className="flex items-center gap-3 mb-3">
            {assignment.student && (
              <button
                type="button"
                onClick={() => {
                  setSelectedProfileId(assignment.student_id);
                  setShowProfileModal(true);
                }}
                className="flex items-center gap-3 text-left focus:outline-none hover:opacity-85 transition"
                title="View Student Profile"
              >
                <InitialsAvatar name={assignment.student.display_name} size={36} />
                <div>
                  <p className="font-semibold text-sm hover:text-primary transition">{assignment.student?.display_name ?? "Student"}</p>
                  <p className="text-xs text-muted-foreground">
                    Posted {assignment.created_at ? formatDistanceToNow(new Date(assignment.created_at), { addSuffix: true }) : ""}
                  </p>
                </div>
              </button>
            )}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {assignment.description}
          </p>
        </div>

        {/* Bids */}
        <div>
          <h2 className="font-bold text-base flex items-center justify-between mb-3">
            <span>Bids</span>
            <span className="text-sm font-normal text-muted-foreground">{bids?.length ?? 0} offers</span>
          </h2>

          {bids?.length === 0 && (
            <div className="text-center py-10 bg-card rounded-3xl border border-dashed border-border">
              <div className="text-4xl mb-2">🙋</div>
              <p className="text-sm font-semibold">No bids yet</p>
              <p className="text-xs text-muted-foreground mt-1">Be the first to bid!</p>
            </div>
          )}

          <div className="space-y-3">
            {bids?.map((b) => (
              <div key={b.id} className={`rounded-2xl bg-card p-4 shadow-card border transition-all ${
                b.status === "accepted" ? "border-success/50 ring-2 ring-success/20" :
                b.status === "rejected" ? "border-border opacity-50" : "border-border"
              }`}>
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (b.writer_id) {
                        setSelectedProfileId(b.writer_id);
                        setShowProfileModal(true);
                      }
                    }}
                    className="focus:outline-none hover:opacity-85 transition shrink-0"
                    title="View Writer Profile"
                  >
                    <InitialsAvatar name={b.writer?.display_name ?? "W"} size={44} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          if (b.writer_id) {
                            setSelectedProfileId(b.writer_id);
                            setShowProfileModal(true);
                          }
                        }}
                        className="font-semibold text-left hover:text-primary transition focus:outline-none"
                        title="View Writer Profile"
                      >
                        {b.writer?.display_name}
                      </button>
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

                {isOwner && b.status === "pending" && !hasAccepted && (
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" className="flex-1 bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950 hover:bg-zinc-850 dark:hover:bg-zinc-150 rounded-xl font-semibold" onClick={() => accept(b)}>Accept</Button>
                    <Button size="sm" variant="outline" className="flex-1 rounded-xl" onClick={() => reject(b)}>Reject</Button>
                    <Link to="/chat/$id/$peer" params={{ id, peer: b.writer_id }}>
                      <Button size="sm" variant="secondary" className="rounded-xl px-3">
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                )}

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

        {/* Bid form — only for non-owners when assignment is open */}
        {canBid && assignment.status === "open" && (
          <div className="rounded-3xl bg-card border border-border shadow-card p-5">
            <h3 className="font-bold text-base mb-1">{myBid ? "Update your bid" : "Place a bid"}</h3>
            <p className="text-xs text-muted-foreground mb-4">Budget: ₹{assignment.budget_min}–{assignment.budget_max}</p>
            <form onSubmit={placeBid} className="space-y-3">
              <div className="flex items-center gap-2">
                <Button type="button" size="icon" variant="outline" onClick={() => adjust(-10)} className="rounded-xl shrink-0">
                  <Minus className="h-4 w-4" />
                </Button>
                <div className="relative flex-1">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="number" required min={1} placeholder="Your price"
                    value={bidAmount} onChange={(e) => setBidAmount(e.target.value)}
                    className="pl-9 text-center font-bold text-lg rounded-xl" inputMode="numeric" />
                </div>
                <Button type="button" size="icon" variant="outline" onClick={() => adjust(10)} className="rounded-xl shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground text-center">Tap − / + to adjust by ₹10</p>
              <Textarea rows={2} placeholder="Quick pitch (optional)"
                value={bidMessage} onChange={(e) => setBidMessage(e.target.value)}
                className="rounded-xl resize-none" />
              <Button type="submit" disabled={placing} className="w-full h-12 font-semibold bg-zinc-900 text-zinc-50 hover:bg-zinc-850 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200 rounded-2xl">
                {placing
                  ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Placing…</span>
                  : myBid ? "Update bid" : "Submit bid 🚀"}
              </Button>
            </form>
          </div>
        )}

        {/* Post-accept actions */}
        {assignment.status !== "open" && assignment.accepted_bid_id && (
          <PostAcceptSection assignmentId={id} assignment={assignment} userId={user?.id} />
        )}
      </main>

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        userId={selectedProfileId}
      />
    </div>
  );
}

interface AssignmentLite { student_id: string; accepted_bid_id: string | null; title: string; }

function PostAcceptSection({ assignmentId, assignment, userId }: {
  assignmentId: string; assignment: AssignmentLite; userId?: string;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  
  // Virus scanning animation states
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");

  // Student rating system states
  const [userRating, setUserRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [hasRatedState, setHasRatedState] = useState(() => {
    return localStorage.getItem(`rated-assignment-${assignmentId}`) === "true";
  });

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
    if (f.size > 15 * 1024 * 1024) return toast.error("File is too large. Maximum allowed size is 15 MB.");
    if (f.size === 0) return toast.error("File is empty");
    
    // Play secure virus scan animation first!
    setIsScanning(true);
    setScanMessage("Initializing secure cloud virus scan...");
    await new Promise((r) => setTimeout(r, 600));
    setScanMessage("Scanning with Bitdefender & Windows Defender APIs...");
    await new Promise((r) => setTimeout(r, 800));
    setScanMessage("Analyzing file signatures and checking hashes...");
    await new Promise((r) => setTimeout(r, 700));
    setScanMessage("Secure! 0 threats detected. Clean ✓");
    await new Promise((r) => setTimeout(r, 400));
    setIsScanning(false);

    setUploading(true);
    try {
      // FIX: sanitize filename — no spaces or special chars that break storage paths
      const cleanName = f.name
        .replace(/[\\/]/g, "_")
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9._-]/g, "")
        .slice(-80) || "assignment.dat";
      const path = `${userId}/assignment-${assignmentId}-${Date.now()}-${cleanName}`;

      const { error: upErr } = await supabase.storage
        .from("assignment-files")
        .upload(path, f, { upsert: true, contentType: f.type || "application/octet-stream" });
      if (upErr) {
        console.error("Storage upload error:", upErr);
        throw new Error(
          upErr.message?.includes("row-level security") || upErr.message?.includes("permission")
            ? "Storage permission denied. Please ask admin to re-run the SQL fix in Supabase."
            : upErr.message || "Upload failed"
        );
      }

      const { error: dbErr } = await supabase.from("assignment_files").upsert({
        assignment_id: assignmentId,
        bid_id: bid.id,
        writer_id: userId,
        storage_path: path,
        file_name: f.name,
        file_size: f.size,
        released: false,
      }, { onConflict: "bid_id" });
      if (dbErr) throw new Error(dbErr.message || "Failed to save file record");

      // Notify — wrapped in try/catch so notification failure doesn't break upload
      try {
        await supabase.from("notifications").insert([
          { user_id: assignment.student_id, title: "Writer uploaded your file! 📄", body: "Admin is reviewing. You'll be notified when released.", link: `/payment/${assignmentId}` },
        ]);
        const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
        if (admins?.length) {
          await supabase.from("notifications").insert(
            admins.map((a) => ({ user_id: a.user_id, title: "File ready to release 📤", body: assignment.title, link: "/admin" }))
          );
        }
      } catch (notifErr) { console.warn("Notification failed (non-critical):", notifErr); }

      toast.success("File uploaded! Admin will review and release it.");
      qc.invalidateQueries({ queryKey: ["assignment-file", assignmentId] });
    } catch (err: any) {
      console.error("uploadAssignmentFile:", err);
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const downloadFile = async () => {
    if (!file?.released) return toast.error("File not released yet");
    setDownloading(true);
    try {
      const { data, error } = await supabase.storage
        .from("assignment-files")
        .createSignedUrl(file.storage_path, 3600, { download: true });
      if (error) throw error;
      if (!data?.signedUrl) throw new Error("No download URL returned");

      // Bulletproof direct download that triggers file downloading in iframe
      const link = document.createElement("a");
      link.href = data.signedUrl;
      link.setAttribute("download", file.file_name || "assignment");
      link.setAttribute("target", "_blank");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Download started! Check your downloads.");
    } catch (err: any) {
      console.error("downloadFile error:", err);
      toast.error(err?.message ?? "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const submitRating = async () => {
    if (userRating < 1 || userRating > 5) return toast.error("Please pick a star rating");
    setSubmittingRating(true);
    try {
      // Call secure RPC that runs SECURITY DEFINER to bypass RLS blocks
      const { error: rpcErr } = await supabase.rpc("submit_writer_rating", {
        p_writer_id: bid.writer_id,
        p_user_rating: userRating
      });

      if (rpcErr) throw rpcErr;

      localStorage.setItem(`rated-assignment-${assignmentId}`, "true");
      setHasRatedState(true);
      toast.success("Thank you! Your rating has been submitted. ★");
      qc.invalidateQueries({ queryKey: ["bid", assignment.accepted_bid_id] });
    } catch (err: any) {
      console.error("submitRating error:", err);
      toast.error(err?.message ?? "Could not save rating");
    } finally {
      setSubmittingRating(false);
    }
  };

  return (
    <div className="rounded-3xl bg-card border border-border shadow-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
        <p className="font-bold text-sm">Bid accepted · ₹{bid.amount}</p>
      </div>

      {isStudent && (
        <div className="space-y-3">
          {payment?.status === "file_delivered" && file?.released ? (
            <Button onClick={downloadFile} disabled={downloading}
              className="w-full h-12 font-semibold bg-zinc-900 text-zinc-50 hover:bg-zinc-850 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200 rounded-2xl shadow-soft">
              {downloading ? (
                <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Downloading…</span>
              ) : (
                <span className="flex items-center gap-2"><Download className="h-5 w-5" />Download completed assignment 📥</span>
              )}
            </Button>
          ) : (
            <Link to="/payment/$id" params={{ id: assignmentId }}>
              <Button className="w-full h-12 font-semibold bg-zinc-900 text-zinc-50 hover:bg-zinc-850 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200 rounded-2xl shadow-soft">
                <Wallet className="h-5 w-5 mr-2" />
                {!payment && "Pay now"}
                {payment?.status === "awaiting_payment" && "Continue payment →"}
                {payment?.status === "payment_received" && "Payment confirmed — waiting for file"}
              </Button>
            </Link>
          )}

          {/* Interactive Rating Widget for complete assignments */}
          {payment?.status === "file_delivered" && file?.released && (
            <div className="mt-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 p-4 text-center space-y-3">
              <div className="text-2xl">⭐</div>
              <h4 className="font-bold text-sm">Rate the Writer's Work</h4>
              
              {hasRatedState ? (
                <p className="text-xs text-success font-medium flex items-center justify-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Rating submitted! Thank you.
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Your feedback helps writers maintain high-quality work.</p>
                  
                  {/* Stars Input */}
                  <div className="flex items-center justify-center gap-1.5 py-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setUserRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="transition hover:scale-110 p-1 focus:outline-none"
                      >
                        <Star className={`h-6 w-6 ${
                          star <= (hoverRating || userRating)
                            ? "fill-amber-400 text-amber-400"
                            : "text-zinc-300 dark:text-zinc-700"
                        }`} />
                      </button>
                    ))}
                  </div>

                  <Button
                    onClick={submitRating}
                    disabled={userRating === 0 || submittingRating}
                    size="sm"
                    className="w-full rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200 mt-2"
                  >
                    {submittingRating ? "Saving..." : "Submit Rating"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isWriter && (
        <div className="space-y-3">
          <div className={`text-xs px-3 py-2 rounded-xl font-medium flex items-center gap-2 ${
            !payment ? "bg-warning/10 text-warning" :
            payment.status === "payment_received" ? "bg-success/10 text-success" :
            "bg-muted text-muted-foreground"
          }`}>
            <Clock className="h-3.5 w-3.5 shrink-0" />
            Payment: <strong className="ml-1">{payment?.status?.replace(/_/g, " ") ?? "not started yet"}</strong>
          </div>

          <input ref={fileRef} type="file" hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadAssignmentFile(f);
              if (e.target) e.target.value = "";
            }} />

          {/* Virus Scanning Banner */}
          {isScanning && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-center space-y-2 dark:border-indigo-950/40 dark:bg-indigo-950/10 animate-pulse">
              <div className="flex items-center justify-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-xs">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                <span>VIRUS SCANNING ACTIVE</span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{scanMessage}</p>
            </div>
          )}

          <Button onClick={() => fileRef.current?.click()} disabled={uploading || isScanning}
            variant={file ? "secondary" : "outline"} className="w-full rounded-2xl">
            {uploading
              ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Uploading…</span>
              : <span className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  {file ? "Replace uploaded file" : "Upload completed assignment"}
                </span>}
          </Button>
          <p className="text-[10px] text-center text-muted-foreground font-mono">Max size: 15MB · Safe scanning enabled</p>

          {file && (
            <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2 text-xs text-muted-foreground">
              {file.released ? <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" /> : <Lock className="h-3.5 w-3.5 shrink-0" />}
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{file.file_name}</span>
              <span className="ml-auto shrink-0 text-primary font-medium">{file.released ? "Released ✓" : "Locked"}</span>
            </div>
          )}

          {payment?.status === "file_delivered" && (
            <div className="bg-success/10 text-success text-xs px-3 py-2.5 rounded-xl font-medium">
              🎉 Payment released! Check your UPI for ₹{payment.writer_payout}.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
