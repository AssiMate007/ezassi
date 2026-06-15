import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, IndianRupee, Copy, Upload, CheckCircle2,
  Clock, Download, Loader2, RefreshCw,
  ShieldCheck, FileText, Sparkles,
} from "lucide-react";
import { toast } from "sonner";

const OWNER_UPI = "neil.zachariahelias@okhdfcbank";
const OWNER_NAME = "AssiMate";

export const Route = createFileRoute("/_app/payment/$id")({
  component: PaymentPage,
});

function PaymentPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const screenshotRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [starting, setStarting] = useState(false);

  const { data: assignment } = useQuery({
    queryKey: ["assignment", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("assignments").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: acceptedBid } = useQuery({
    queryKey: ["accepted-bid", id],
    enabled: !!assignment?.accepted_bid_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bids")
        .select("*, writer:profiles!bids_writer_id_fkey(display_name)")
        .eq("id", assignment!.accepted_bid_id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: payment, refetch: refetchPayment } = useQuery({
    queryKey: ["payment", id],
    staleTime: 0,
    refetchInterval: 8_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("assignment_id", id)
        .maybeSingle();
      return data ?? null;
    },
  });

  const { data: file, refetch: refetchFile } = useQuery({
    queryKey: ["assignment-file", id],
    staleTime: 0,
    refetchInterval: 8_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("assignment_files")
        .select("*")
        .eq("assignment_id", id)
        .maybeSingle();
      return data ?? null;
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`pay-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `assignment_id=eq.${id}` }, () => refetchPayment())
      .on("postgres_changes", { event: "*", schema: "public", table: "assignment_files", filter: `assignment_id=eq.${id}` }, () => refetchFile())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, refetchPayment, refetchFile]);

  if (!assignment)
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );

  if (!acceptedBid)
    return (
      <div className="p-6 text-center">
        <div className="text-5xl mb-3">🤝</div>
        <p className="font-semibold">No accepted bid yet</p>
        <p className="text-sm text-muted-foreground mt-1 mb-4">Accept a bid first to proceed with payment.</p>
        <Link to="/assignment/$id" params={{ id }} className="text-primary underline text-sm">← Back to assignment</Link>
      </div>
    );

  const isStudent = user?.id === assignment.student_id;
  const isWriter = user?.id === acceptedBid.writer_id;
  const amount = acceptedBid.amount;
  const commission = Math.round(amount * 0.15);
  const writerPayout = amount - commission;

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied!");
  };

  const startPayment = async () => {
    if (!user) return toast.error("Not signed in");
    if (!acceptedBid) return toast.error("No accepted bid");
    setStarting(true);
    try {
      const { data: existing, error: checkErr } = await supabase
        .from("payments")
        .select("id, status")
        .eq("assignment_id", id)
        .maybeSingle();

      if (checkErr) throw checkErr;

      if (existing) {
        await refetchPayment();
        toast.success("Payment already started — scroll down to continue");
        return;
      }

      const { data: inserted, error: insertErr } = await supabase
        .from("payments")
        .insert({
          assignment_id: id,
          bid_id: acceptedBid.id,
          student_id: assignment.student_id,
          writer_id: acceptedBid.writer_id,
          amount,
          commission,
          writer_payout: writerPayout,
          status: "awaiting_payment",
        })
        .select()
        .single();

      if (insertErr) {
        if (insertErr.code === "23505") {
          await refetchPayment();
          return;
        }
        throw insertErr;
      }

      await refetchPayment();
      toast.success("Payment started! Scan the QR below 👇");
    } catch (err: any) {
      console.error("startPayment error:", err);
      toast.error(err?.message ?? "Could not start payment — check console");
    } finally {
      setStarting(false);
    }
  };

  const uploadScreenshot = async (f: File) => {
    if (!user) return toast.error("Not signed in");
    if (!payment) return toast.error("Start payment first");
    if (!f.type.startsWith("image/")) return toast.error("Please upload an image");
    if (f.size > 10 * 1024 * 1024) return toast.error("Image must be under 10 MB");
    setUploading(true);
    try {
      const rawExt = (f.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
      const ext = rawExt.slice(0, 5) || "png";
      const path = `${user.id}/screenshot-${payment.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("assignment-files")
        .upload(path, f, { upsert: true, contentType: f.type });
      if (upErr) throw upErr;

      const { error: updateErr } = await supabase
        .from("payments")
        .update({ screenshot_url: path })
        .eq("id", payment.id);
      if (updateErr) throw updateErr;

      // FIX: Notify admins with proper error handling
      try {
        const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
        if (admins?.length) {
          const { error: notifErr } = await supabase.from("notifications").insert(
            admins.map((a) => ({
              user_id: a.user_id,
              title: "💰 New payment screenshot",
              body: `₹${amount} for "${assignment.title}" — verify now`,
              link: "/admin",
            }))
          );
          if (notifErr) console.error("Notification error:", notifErr);
        }
      } catch (notifErr) {
        console.error("Admin notification failed:", notifErr);
      }

      toast.success("Screenshot uploaded! Admin will verify soon.");
      await refetchPayment();
    } catch (err: any) {
      console.error("uploadScreenshot error:", err);
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const uploadWriterFile = async (f: File) => {
    if (!user || !acceptedBid) return;
    if (f.size > 25 * 1024 * 1024) return toast.error("File must be under 25 MB");
    if (f.size === 0) return toast.error("File is empty");
    setUploading(true);
    try {
      // Sanitize filename: drop any path separators, weird unicode, spaces -> _
      const cleanName = f.name
        .replace(/[\\/]/g, "_")
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9._-]/g, "")
        .slice(-80) || "assignment.dat";
      const path = `${user.id}/assignment-${id}-${Date.now()}-${cleanName}`;

      const { error: upErr } = await supabase.storage
        .from("assignment-files")
        .upload(path, f, {
          upsert: true,
          contentType: f.type || "application/octet-stream",
        });
      if (upErr) {
        console.error("Storage upload error:", upErr);
        throw new Error(
          upErr.message?.includes("row-level security")
            ? "Storage policy blocked upload. Ask admin to re-apply migrations."
            : upErr.message || "Storage upload failed",
        );
      }

      const { error: dbErr } = await supabase.from("assignment_files").upsert(
        {
          assignment_id: id,
          bid_id: acceptedBid.id,
          writer_id: user.id,
          storage_path: path,
          file_name: cleanName,
          file_size: f.size,
          released: false,
        },
        { onConflict: "bid_id" },
      );
      if (dbErr) {
        console.error("DB insert error:", dbErr);
        throw new Error(
          dbErr.message?.includes("row-level security")
            ? "Database policy blocked. Re-apply RLS migrations."
            : dbErr.message || "Failed to save file record",
        );
      }

      // FIX: Notify with proper error handling
      try {
        await supabase.from("notifications").insert([
          { user_id: assignment!.student_id, title: "Writer uploaded your file! 📄", body: "Admin is reviewing. You'll be notified when released.", link: `/payment/${id}` },
        ]);
        const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
        if (admins?.length) {
          const { error: notifErr } = await supabase.from("notifications").insert(
            admins.map((a) => ({ user_id: a.user_id, title: "File ready to release 📤", body: assignment!.title, link: "/admin" }))
          );
          if (notifErr) console.error("Admin notification error:", notifErr);
        }
      } catch (notifErr) {
        console.error("Notification failed:", notifErr);
      }

      toast.success("File uploaded! Locked until admin releases it.");
      qc.invalidateQueries({ queryKey: ["assignment-file", id] });
      refetchFile();
    } catch (err: any) {
      console.error("uploadWriterFile error:", err);
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const downloadFile = async () => {
    if (!file?.released) return toast.error("File not released yet");
    setDownloading(true);
    const { data, error } = await supabase.storage
      .from("assignment-files")
      .createSignedUrl(file.storage_path, 3600);
    setDownloading(false);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="px-4 pt-6 pb-10 max-w-md mx-auto">
      <button
        onClick={() => navigate({ to: "/assignment/$id", params: { id } })}
        className="mb-4 text-muted-foreground flex items-center gap-1.5 text-sm hover:text-foreground transition"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <h1 className="text-2xl font-bold mb-1">Payment</h1>
      <p className="text-sm text-muted-foreground line-clamp-1 mb-5">{assignment.title}</p>

      <div className="rounded-3xl bg-gradient-primary p-5 text-primary-foreground shadow-glow mb-5 relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="relative">
          <p className="text-xs uppercase tracking-widest opacity-75 mb-1">Amount</p>
          <div className="flex items-center text-4xl font-bold">
            <IndianRupee className="h-8 w-8" />
            {amount}
          </div>
          <p className="text-sm mt-2 opacity-80">
            Writer: <strong>{acceptedBid.writer?.display_name}</strong>
          </p>
          <div className="flex gap-3 mt-3 text-xs">
            <div className="bg-white/15 rounded-xl px-3 py-1.5">
              <p className="opacity-75">Platform (15%)</p>
              <p className="font-bold">₹{commission}</p>
            </div>
            <div className="bg-white/15 rounded-xl px-3 py-1.5">
              <p className="opacity-75">Writer gets</p>
              <p className="font-bold">₹{writerPayout}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── STATE: Complete — student downloads ── */}
      {payment?.status === "file_delivered" && file?.released && isStudent && (
        <div className="space-y-4 mb-4">
          <div className="rounded-3xl bg-gradient-primary p-6 text-primary-foreground shadow-glow relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-3xl pointer-events-none" />
            <div className="relative text-center">
              <div className="text-5xl mb-3">🎉</div>
              <p className="font-bold text-xl mb-1">Assignment complete!</p>
              <p className="text-sm opacity-80 mb-4">{file.file_name}</p>
              <Button onClick={downloadFile} disabled={downloading}
                className="w-full h-12 bg-white/20 hover:bg-white/30 backdrop-blur border border-white/30 text-white font-semibold rounded-2xl">
                {downloading
                  ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Preparing…</span>
                  : <span className="flex items-center gap-2"><Download className="h-5 w-5" />Download your file</span>}
              </Button>
            </div>
          </div>
          <div className="rounded-2xl bg-card border border-border p-4 shadow-card space-y-2 text-xs">
            <p className="font-semibold text-sm mb-2">Summary</p>
            <div className="flex justify-between"><span className="text-muted-foreground">Amount paid</span><span className="font-semibold">₹{amount}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Writer</span><span>{acceptedBid.writer?.display_name}</span></div>
            {payment.released_at && <div className="flex justify-between"><span className="text-muted-foreground">Released</span><span>{new Date(payment.released_at).toLocaleString()}</span></div>}
          </div>
        </div>
      )}

      {/* ── STATE: Complete — writer sees payout ── */}
      {payment?.status === "file_delivered" && isWriter && (
        <div className="rounded-3xl bg-gradient-primary p-5 text-primary-foreground shadow-glow mb-4 text-center">
          <div className="text-4xl mb-2">💸</div>
          <p className="font-bold text-lg">Job complete!</p>
          <p className="text-sm opacity-80 mt-1 mb-4">Your payout: ₹{writerPayout}</p>
          {payment.writer_upi_id
            ? <p className="text-sm bg-white/15 rounded-xl px-4 py-2.5 font-mono">{payment.writer_upi_id}</p>
            : <p className="text-sm bg-white/15 rounded-xl px-4 py-2.5 opacity-75">Go to Profile → add your UPI to receive payout</p>}
        </div>
      )}

      {/* ── STATE: File pending admin release ── */}
      {payment?.status === "payment_received" && file && !file.released && isStudent && (
        <div className="rounded-3xl bg-card border border-primary/30 shadow-card p-5 mb-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-bold">File ready — admin reviewing</p>
              <p className="text-sm text-muted-foreground mt-1">Writer uploaded your assignment. Admin is reviewing before releasing it to you.</p>
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Usually a few hours</p>
            </div>
          </div>
        </div>
      )}

      {/* ── STATE: Payment confirmed, writer uploading ── */}
      {payment?.status === "payment_received" && !file && isStudent && (
        <div className="rounded-3xl bg-success/10 border border-success/30 p-5 mb-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-success shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-success">Payment confirmed ✓</p>
              <p className="text-sm text-muted-foreground mt-1">Writer is working on your assignment. You'll be notified when the file is ready.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── STATE: Awaiting — show QR + screenshot ── */}
      {payment?.status === "awaiting_payment" && isStudent && (
        <div className="rounded-3xl bg-card border border-border shadow-card p-5 mb-4 space-y-4">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-9 w-9 rounded-2xl bg-primary/10 flex items-center justify-center font-bold text-primary">2</div>
              <div><p className="font-semibold">Pay via UPI</p><p className="text-xs text-muted-foreground">GPay · PhonePe · Paytm · any UPI app</p></div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-muted/60 rounded-2xl px-4 py-3">
                <div><p className="text-[11px] text-muted-foreground uppercase tracking-wide">UPI ID</p><p className="font-mono text-sm font-semibold">{OWNER_UPI}</p></div>
                <Button size="sm" variant="ghost" onClick={() => copy(OWNER_UPI)} className="rounded-xl"><Copy className="h-4 w-4" /></Button>
              </div>
              <div className="flex items-center justify-between bg-primary/8 rounded-2xl px-4 py-3">
                <div><p className="text-[11px] text-muted-foreground uppercase tracking-wide">Pay exactly</p><p className="font-bold text-lg text-primary flex items-center"><IndianRupee className="h-4 w-4" />{amount}</p></div>
                <Button size="sm" variant="ghost" onClick={() => copy(String(amount))} className="rounded-xl"><Copy className="h-4 w-4" /></Button>
              </div>
              <p className="text-xs text-center text-muted-foreground">Name: <strong>{OWNER_NAME}</strong></p>
            </div>
          </div>
          <div className="border-t border-border pt-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-2xl bg-primary/10 flex items-center justify-center font-bold text-primary">3</div>
              <div><p className="font-semibold">Upload screenshot</p><p className="text-xs text-muted-foreground">After paying — upload proof to notify admin</p></div>
            </div>
            <input ref={screenshotRef} type="file" accept="image/*" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadScreenshot(f); e.target.value = ""; }} />
            <Button onClick={() => screenshotRef.current?.click()} disabled={uploading}
              className={`w-full h-12 rounded-2xl font-semibold ${payment.screenshot_url ? "bg-success hover:bg-success/90 text-success-foreground" : "bg-gradient-primary"}`}>
              {uploading
                ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Uploading…</span>
                : payment.screenshot_url
                  ? <span className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5" />Screenshot uploaded ✓ — tap to replace</span>
                  : <span className="flex items-center gap-2"><Upload className="h-5 w-5" />Upload payment screenshot</span>}
            </Button>
            {payment.screenshot_url && (
              <div className="mt-3 flex items-center gap-2 bg-success/10 rounded-2xl px-4 py-3 text-success text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0" />Waiting for admin to verify. You'll be notified!
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── STATE: Not started yet ── */}
      {isStudent && !payment && (
        <div className="rounded-3xl bg-card border border-border shadow-card p-5 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-9 w-9 rounded-2xl bg-primary/10 flex items-center justify-center font-bold text-primary">1</div>
            <div><p className="font-semibold">Ready to pay?</p><p className="text-xs text-muted-foreground">Tap to see UPI details</p></div>
          </div>
          <Button onClick={startPayment} disabled={starting}
            className="w-full h-12 text-base font-semibold bg-gradient-primary shadow-soft rounded-2xl">
            {starting
              ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Setting up…</span>
              : <span className="flex items-center gap-2"><IndianRupee className="h-5 w-5" />Pay now — ₹{amount}</span>}
          </Button>
        </div>
      )}

      {/* ── Writer upload — hidden when complete ── */}
      {isWriter && payment?.status !== "file_delivered" && (
        <div className="rounded-3xl bg-card border border-border shadow-card p-5 mb-4">
          <h3 className="font-bold mb-3">Upload completed assignment</h3>
          <div className={`text-xs px-3 py-2 rounded-xl mb-3 font-medium flex items-center gap-2 ${
            !payment ? "bg-warning/10 text-warning" :
            payment.status === "payment_received" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
          }`}>
            <Clock className="h-3.5 w-3.5 shrink-0" />
            Payment: <strong className="ml-1">{payment?.status?.replace(/_/g, " ") ?? "not started"}</strong>
          </div>
          <input ref={fileRef} type="file" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; uploadWriterFile(f); if (e.target) e.target.value = ""; }} />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading} variant="outline" className="w-full rounded-2xl">
            {uploading
              ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Uploading…</span>
              : <span className="flex items-center gap-2"><Upload className="h-4 w-4" />{file ? "Replace uploaded file" : "Upload completed assignment"}</span>}
          </Button>
          {file && (
            <div className="mt-2 flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2 text-xs text-muted-foreground">
              {file.released ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Clock className="h-3.5 w-3.5" />}
              <span className="truncate">{file.file_name}</span>
              <span className="ml-auto font-medium text-primary">{file.released ? "Released ✓" : "Pending admin review"}</span>
            </div>
          )}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2 justify-center text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-success" />
        Secured by AssiMate · Verified by admin
      </div>

      <button
        onClick={() => {
          refetchPayment();
          refetchFile();
          toast.success("Refreshed");
        }}
        className="mt-3 w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-primary transition py-2"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Check for updates
      </button>
    </div>
  );
}
