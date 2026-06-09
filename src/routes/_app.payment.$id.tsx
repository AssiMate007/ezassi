import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, IndianRupee, Copy, Upload, CheckCircle2,
  Clock, Download, AlertTriangle, Loader2, RefreshCw,
  ShieldCheck, FileText, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import upiQr from "@/assets/upi-qr.jpg";

const OWNER_UPI  = "neil.zachariahelias@okhdfcbank";
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
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [starting, setStarting] = useState(false);

  /* ── queries ─────────────────────────────────────── */
  const { data: assignment } = useQuery({
    queryKey: ["assignment", id],
    queryFn: async () => {
      const { data } = await supabase.from("assignments").select("*").eq("id", id).single();
      return data;
    },
  });

  const { data: acceptedBid } = useQuery({
    queryKey: ["accepted-bid", id],
    enabled: !!assignment?.accepted_bid_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("bids")
        .select("*, writer:profiles!bids_writer_id_fkey(display_name)")
        .eq("id", assignment!.accepted_bid_id!)
        .single();
      return data;
    },
  });

  const { data: payment, refetch: refetchPayment } = useQuery({
    queryKey: ["payment", id],
    // FIX: query by assignment_id not bid_id so it works even before bid row exists
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("assignment_id", id)
        .maybeSingle();
      return data;
    },
    // always fresh
    staleTime: 0,
    refetchInterval: 10_000,
  });

  const { data: file, refetch: refetchFile } = useQuery({
    queryKey: ["assignment-file", id],
    staleTime: 0,
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("assignment_files")
        .select("*")
        .eq("assignment_id", id)
        .maybeSingle();
      return data;
    },
  });

  // Realtime: update when payment row changes
  useEffect(() => {
    const ch = supabase
      .channel(`payment-page-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `assignment_id=eq.${id}` }, () => {
        refetchPayment();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "assignment_files", filter: `assignment_id=eq.${id}` }, () => {
        refetchFile();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, refetchPayment, refetchFile]);

  /* ── loading states ────────────────────────────── */
  if (!assignment) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Loading payment…</p>
    </div>
  );

  if (!acceptedBid) return (
    <div className="p-6 text-center">
      <div className="text-5xl mb-3">🤝</div>
      <p className="font-semibold">No accepted bid yet</p>
      <p className="text-sm text-muted-foreground mt-1 mb-4">Accept a bid first to start payment.</p>
      <Link to="/assignment/$id" params={{ id }} className="text-primary underline text-sm">← Back to assignment</Link>
    </div>
  );

  const isStudent = user?.id === assignment.student_id;
  const amount = acceptedBid.amount;
  const commission = Math.round(amount * 0.15);
  const writerPayout = amount - commission;

  const copy = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copied!"); };

  /* ── FIX: startPayment with proper error handling ── */
  const startPayment = async () => {
    if (!user || !acceptedBid) return;
    setStarting(true);
    try {
      // Check if payment already exists
      const { data: existing } = await supabase
        .from("payments")
        .select("id")
        .eq("assignment_id", id)
        .maybeSingle();

      if (existing) {
        await refetchPayment();
        setStarting(false);
        return;
      }

      const { error } = await supabase.from("payments").insert({
        assignment_id: id,
        bid_id: acceptedBid.id,
        student_id: assignment.student_id,
        writer_id: acceptedBid.writer_id,
        amount,
        commission,
        writer_payout: writerPayout,
        status: "awaiting_payment",
      });

      if (error) throw error;
      await refetchPayment();
      toast.success("Payment started — scan the QR below");
    } catch (err: any) {
      if (err?.message?.includes("duplicate") || err?.message?.includes("unique")) {
        await refetchPayment();
      } else {
        toast.error(err?.message ?? "Could not start payment");
      }
    } finally {
      setStarting(false);
    }
  };

  /* ── FIX: uploadScreenshot with better validation ── */
  const uploadScreenshot = async (f: File) => {
    if (!user || !payment) return toast.error("Start the payment first");
    if (!f.type.startsWith("image/")) return toast.error("Please upload an image file");
    if (f.size > 10 * 1024 * 1024) return toast.error("Image must be under 10 MB");

    setUploading(true);
    try {
      const path = `${user.id}/payment-${payment.id}-${Date.now()}-${f.name}`;
      const { error: upErr } = await supabase.storage
        .from("assignment-files")
        .upload(path, f, { upsert: true });
      if (upErr) throw upErr;

      const { error } = await supabase
        .from("payments")
        .update({ screenshot_url: path })
        .eq("id", payment.id);
      if (error) throw error;

      // Notify admin
      const { data: admins } = await supabase
        .from("user_roles").select("user_id").eq("role", "admin");
      if (admins?.length) {
        await supabase.from("notifications").insert(
          admins.map((a) => ({
            user_id: a.user_id,
            title: "💰 New payment screenshot",
            body: `₹${amount} for "${assignment.title}" — verify now`,
            link: "/admin",
          }))
        );
      }
      toast.success("Screenshot uploaded! Admin will verify within a few hours.");
      await refetchPayment();
    } catch (err: any) {
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
    if (error || !data) return toast.error(error?.message ?? "Failed to get download link");
    window.open(data.signedUrl, "_blank");
  };

  /* ── render ────────────────────────────────────── */
  return (
    <div className="px-4 pt-6 pb-8 max-w-md mx-auto">
      <button onClick={() => navigate({ to: "/assignment/$id", params: { id } })}
        className="mb-4 text-muted-foreground flex items-center gap-1.5 text-sm hover:text-foreground transition">
        <ArrowLeft className="h-4 w-4" /> Back to assignment
      </button>

      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Payment</h1>
        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{assignment.title}</p>
      </div>

      {/* Amount hero */}
      <div className="rounded-3xl bg-gradient-primary p-5 text-primary-foreground shadow-glow mb-5 relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="relative">
          <p className="text-xs uppercase tracking-widest opacity-75 mb-1">Amount to pay</p>
          <div className="flex items-center text-4xl font-bold">
            <IndianRupee className="h-8 w-8" />{amount}
          </div>
          <p className="text-sm mt-3 opacity-80">Writer: <strong>{acceptedBid.writer?.display_name}</strong></p>
          <div className="flex gap-4 mt-3 text-xs">
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

      {/* ── STEP 1: Start payment ── */}
      {isStudent && !payment && (
        <div className="rounded-3xl bg-card border border-border shadow-card p-5 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <span className="font-bold text-primary">1</span>
            </div>
            <div>
              <p className="font-semibold">Ready to pay?</p>
              <p className="text-xs text-muted-foreground">Tap below to see payment details</p>
            </div>
          </div>
          <Button onClick={startPayment} disabled={starting}
            className="w-full h-12 text-base font-semibold bg-gradient-primary shadow-soft rounded-2xl">
            {starting
              ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Setting up…</span>
              : <span className="flex items-center gap-2"><IndianRupee className="h-5 w-5" />Pay now ₹{amount}</span>
            }
          </Button>
        </div>
      )}

      {/* ── STEP 2: QR + Screenshot upload ── */}
      {payment && payment.status === "awaiting_payment" && isStudent && (
        <>
          {/* QR card */}
          <div className="rounded-3xl bg-card border border-border shadow-card p-5 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                <span className="font-bold text-primary">2</span>
              </div>
              <div>
                <p className="font-semibold">Scan & pay via UPI</p>
                <p className="text-xs text-muted-foreground">Use any UPI app — GPay, PhonePe, Paytm</p>
              </div>
            </div>

            <img src={upiQr} alt="UPI QR code" className="w-full rounded-2xl border border-border mb-4 shadow-xs" />

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 bg-muted/60 rounded-2xl px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">UPI ID</p>
                  <p className="font-mono text-sm font-semibold truncate">{OWNER_UPI}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => copy(OWNER_UPI)} className="rounded-xl shrink-0">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center justify-between gap-2 bg-primary/8 rounded-2xl px-4 py-3">
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Pay exactly</p>
                  <p className="font-bold text-lg flex items-center text-primary">
                    <IndianRupee className="h-4 w-4" />{amount}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => copy(String(amount))} className="rounded-xl">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="bg-muted/40 rounded-xl px-3 py-2 text-xs text-muted-foreground">
                Name: <strong>{OWNER_NAME}</strong>
              </div>
            </div>
          </div>

          {/* Screenshot upload */}
          <div className="rounded-3xl bg-card border border-border shadow-card p-5 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                <span className="font-bold text-primary">3</span>
              </div>
              <div>
                <p className="font-semibold">Upload payment screenshot</p>
                <p className="text-xs text-muted-foreground">Admin verifies within a few hours</p>
              </div>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadScreenshot(f);
                e.target.value = ""; // allow re-selecting same file
              }}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className={`w-full h-12 rounded-2xl font-semibold ${payment.screenshot_url ? "bg-success hover:bg-success/90 text-success-foreground" : "bg-gradient-primary"}`}
            >
              {uploading
                ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Uploading…</span>
                : payment.screenshot_url
                  ? <span className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5" />Screenshot uploaded — tap to replace</span>
                  : <span className="flex items-center gap-2"><Upload className="h-5 w-5" />Upload screenshot</span>
              }
            </Button>

            {payment.screenshot_url && (
              <div className="mt-3 flex items-center gap-2 bg-success/10 rounded-2xl px-4 py-3 text-success text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <p className="font-medium">Waiting for admin to verify. You'll be notified!</p>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-warning/10 border border-warning/20 p-4 text-xs flex gap-2.5">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <p className="text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Important:</strong> Only pay the exact amount shown. Do not close this page after paying before uploading a screenshot.
            </p>
          </div>
        </>
      )}

      {/* ── Payment received, waiting for file ── */}
      {payment && payment.status === "payment_received" && (
        <div className="rounded-3xl bg-success/10 border border-success/30 p-5 mb-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-success shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-success">Payment confirmed ✓</p>
              <p className="text-sm text-muted-foreground mt-1">
                The writer has been notified and is working on your assignment. You'll get a notification when it's ready.
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground bg-background/50 rounded-2xl px-3 py-2.5">
            <Clock className="h-3.5 w-3.5" />
            Waiting for writer to upload the completed assignment…
          </div>
        </div>
      )}

      {/* ── File ready to download ── */}
      {payment && file && file.released && (
        <div className="rounded-3xl bg-gradient-primary p-5 text-primary-foreground shadow-glow mb-4">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="h-6 w-6" />
            <div>
              <p className="font-bold text-lg">Assignment ready! 🎉</p>
              <p className="text-sm opacity-80">{file.file_name}</p>
            </div>
          </div>
          <Button
            onClick={downloadFile}
            disabled={downloading}
            className="w-full h-12 bg-white/20 hover:bg-white/30 backdrop-blur border border-white/30 text-white font-semibold rounded-2xl"
          >
            {downloading
              ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Preparing…</span>
              : <span className="flex items-center gap-2"><Download className="h-5 w-5" />Download file</span>
            }
          </Button>
        </div>
      )}

      {/* File uploaded but not yet released */}
      {payment && file && !file.released && payment.status === "payment_received" && (
        <div className="rounded-3xl bg-card border border-border shadow-card p-5 mb-4">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" />
            <div>
              <p className="font-semibold">File uploaded by writer</p>
              <p className="text-xs text-muted-foreground mt-0.5">Admin is reviewing and will release it shortly.</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-xl px-3 py-2">
            <Clock className="h-3.5 w-3.5" />{file.file_name}
          </div>
        </div>
      )}

      {/* ── Trust badge ── */}
      <div className="mt-4 flex items-center gap-2 justify-center text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-success" />
        Secured by AssiMate · All payments verified by admin
      </div>

      {/* ── Manual refresh (in case realtime isn't firing) ── */}
      <button
        onClick={() => { refetchPayment(); refetchFile(); toast.success("Refreshed"); }}
        className="mt-4 w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-primary transition py-2"
      >
        <RefreshCw className="h-3.5 w-3.5" />Check for updates
      </button>
    </div>
  );
}
