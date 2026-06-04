import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, IndianRupee, Copy, Upload, CheckCircle2, Clock, Download, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import upiQr from "@/assets/upi-qr.jpg";

const OWNER_UPI = "neil.zachariahelias@okhdfcbank";
const OWNER_NAME = "AssiMate";

export const Route = createFileRoute("/_app/payment/$id")({
  component: PaymentPage,
});

function PaymentPage() {
  const { id } = Route.useParams(); // assignment id
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);

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
    queryKey: ["payment", acceptedBid?.id],
    enabled: !!acceptedBid?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("bid_id", acceptedBid!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: file } = useQuery({
    queryKey: ["assignment-file", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("assignment_files")
        .select("*")
        .eq("assignment_id", id)
        .maybeSingle();
      return data;
    },
  });

  if (!assignment) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!acceptedBid) return (
    <div className="p-8 text-center text-muted-foreground">
      <p>No accepted bid yet for this assignment.</p>
      <Link to="/assignment/$id" params={{ id }} className="text-primary underline mt-2 inline-block">Back to assignment</Link>
    </div>
  );

  const isStudent = user?.id === assignment.student_id;
  const amount = acceptedBid.amount;
  const commission = Math.round(amount * 0.15);
  const writerPayout = amount - commission;

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  const startPayment = async () => {
    if (!user) return;
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
    if (error && !error.message.includes("duplicate")) return toast.error(error.message);
    refetchPayment();
  };

  const uploadScreenshot = async (file: File) => {
    if (!user || !payment) return;
    setUploading(true);
    const path = `${user.id}/payment-${payment.id}-${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("assignment-files").upload(path, file);
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const { error } = await supabase.from("payments").update({ screenshot_url: path }).eq("id", payment.id);
    setUploading(false);
    if (error) return toast.error(error.message);
    // notify admin
    const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
    if (admins?.length) {
      await supabase.from("notifications").insert(admins.map((a) => ({
        user_id: a.user_id,
        title: "New payment to verify",
        body: `₹${amount} for "${assignment.title}"`,
        link: `/admin`,
      })));
    }
    toast.success("Screenshot uploaded — admin will verify soon");
    refetchPayment();
  };

  const downloadFile = async () => {
    if (!file?.released) return toast.error("File not released yet");
    setDownloading(true);
    const { data, error } = await supabase.storage.from("assignment-files").createSignedUrl(file.storage_path, 3600);
    setDownloading(false);
    if (error || !data) return toast.error(error?.message ?? "Failed");
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="px-4 pt-6 pb-4">
      <button onClick={() => navigate({ to: "/assignment/$id", params: { id } })} className="mb-4 text-muted-foreground flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <h1 className="text-xl font-bold mb-1">Payment</h1>
      <p className="text-sm text-muted-foreground mb-4 line-clamp-1">{assignment.title}</p>

      {/* Amount card */}
      <div className="rounded-2xl bg-gradient-primary p-5 text-primary-foreground shadow-card mb-4">
        <p className="text-xs uppercase tracking-wide opacity-80">Amount to pay</p>
        <div className="flex items-center text-4xl font-bold mt-1">
          <IndianRupee className="h-7 w-7" />{amount}
        </div>
        <p className="text-xs mt-2 opacity-80">Writer: {acceptedBid.writer?.display_name}</p>
      </div>

      {isStudent && !payment && (
        <Button onClick={startPayment} className="w-full bg-gradient-primary">Start payment</Button>
      )}

      {payment && payment.status === "awaiting_payment" && isStudent && (
        <>
          <div className="rounded-2xl bg-card border border-border p-4 shadow-card mb-4">
            <p className="text-sm font-semibold mb-3">Scan & pay with any UPI app</p>
            <img src={upiQr} alt="UPI QR" className="w-full rounded-xl border border-border" />
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2 bg-muted rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">UPI ID</p>
                  <p className="font-mono text-xs truncate">{OWNER_UPI}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => copy(OWNER_UPI)}><Copy className="h-4 w-4" /></Button>
              </div>
              <div className="flex items-center justify-between gap-2 bg-muted rounded-lg px-3 py-2">
                <div>
                  <p className="text-xs text-muted-foreground">Pay exactly</p>
                  <p className="font-bold flex items-center"><IndianRupee className="h-4 w-4" />{amount}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => copy(String(amount))}><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-card border border-border p-4 shadow-card mb-4">
            <p className="text-sm font-semibold mb-1">After paying, upload screenshot</p>
            <p className="text-xs text-muted-foreground mb-3">Admin verifies within a few hours.</p>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadScreenshot(e.target.files[0])} />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full bg-gradient-primary">
              <Upload className="h-4 w-4 mr-2" />{uploading ? "Uploading…" : payment.screenshot_url ? "Replace screenshot" : "Upload screenshot"}
            </Button>
            {payment.screenshot_url && (
              <p className="text-xs text-success mt-2 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Screenshot received — waiting for admin</p>
            )}
          </div>

          <div className="rounded-xl bg-warning/10 border border-warning/30 p-3 text-xs flex gap-2">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <p><strong>No refunds.</strong> All payments are final once made. The file is released only after payment is confirmed.</p>
          </div>
        </>
      )}

      {payment && payment.status === "payment_received" && (
        <div className="rounded-2xl bg-success/10 border border-success/30 p-4 mb-4 flex items-start gap-2">
          <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Payment received ✓</p>
            <p className="text-xs text-muted-foreground">Waiting for writer to upload the assignment. You'll be notified.</p>
          </div>
        </div>
      )}

      {payment && file && (
        <div className="rounded-2xl bg-card border border-border p-4 shadow-card mb-4">
          <p className="text-sm font-semibold mb-2">Assignment file</p>
          {file.released ? (
            <Button onClick={downloadFile} disabled={downloading} className="w-full bg-gradient-primary">
              <Download className="h-4 w-4 mr-2" />{downloading ? "…" : `Download ${file.file_name}`}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />File uploaded by writer — locked until admin releases it.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
