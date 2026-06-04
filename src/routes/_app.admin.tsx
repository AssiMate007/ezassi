import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { IndianRupee, CheckCircle2, Clock, FileText, ExternalLink, ShieldAlert, Wallet, TrendingUp, Eye } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin")({
  component: AdminPage,
});

interface PaymentRow {
  id: string;
  assignment_id: string;
  bid_id: string;
  student_id: string;
  writer_id: string;
  amount: number;
  commission: number;
  writer_payout: number;
  screenshot_url: string | null;
  status: "awaiting_payment" | "payment_received" | "file_delivered" | "cancelled";
  created_at: string;
  payment_received_at: string | null;
  released_at: string | null;
  assignment: { title: string; subject: string } | null;
  student: { display_name: string; upi_id: string | null } | null;
  writer: { display_name: string; upi_id: string | null } | null;
}

function AdminPage() {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const [viewing, setViewing] = useState<string | null>(null);

  const { data: payments, isLoading } = useQuery({
    queryKey: ["admin-payments"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select(`*, assignment:assignments(title,subject), student:profiles!payments_student_id_fkey(display_name,upi_id), writer:profiles!payments_writer_id_fkey(display_name,upi_id)`)
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as PaymentRow[];
    },
  });

  const { data: files } = useQuery({
    queryKey: ["admin-files"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("assignment_files").select("*");
      return data ?? [];
    },
  });

  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <ShieldAlert className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">Admin access only.</p>
      </div>
    );
  }

  const totalRevenue = payments?.filter((p) => p.status !== "awaiting_payment" && p.status !== "cancelled").reduce((s, p) => s + p.amount, 0) ?? 0;
  const totalProfit = payments?.filter((p) => p.status !== "awaiting_payment" && p.status !== "cancelled").reduce((s, p) => s + p.commission, 0) ?? 0;
  const totalPayouts = payments?.filter((p) => p.status !== "awaiting_payment" && p.status !== "cancelled").reduce((s, p) => s + p.writer_payout, 0) ?? 0;
  const pendingVerify = payments?.filter((p) => p.status === "awaiting_payment" && p.screenshot_url).length ?? 0;

  const fileForBid = (bid_id: string) => files?.find((f) => f.bid_id === bid_id);

  const markReceived = async (p: PaymentRow) => {
    const { error } = await supabase.from("payments")
      .update({ status: "payment_received", payment_received_at: new Date().toISOString() })
      .eq("id", p.id);
    if (error) return toast.error(error.message);
    await supabase.from("notifications").insert([
      { user_id: p.student_id, title: "Payment received ✓", body: `Your payment of ₹${p.amount} is confirmed.`, link: `/payment/${p.assignment_id}` },
      { user_id: p.writer_id, title: "New paid job", body: `Student paid ₹${p.amount}. Please upload the assignment.`, link: `/assignment/${p.assignment_id}` },
    ]);
    toast.success("Marked received & notified");
    qc.invalidateQueries({ queryKey: ["admin-payments"] });
  };

  const releaseFile = async (p: PaymentRow) => {
    const f = fileForBid(p.bid_id);
    if (!f) return toast.error("No file uploaded yet");
    const { error } = await supabase.from("assignment_files").update({ released: true }).eq("id", f.id);
    if (error) return toast.error(error.message);
    await supabase.from("payments").update({ status: "file_delivered", released_at: new Date().toISOString() }).eq("id", p.id);
    await supabase.from("notifications").insert([
      { user_id: p.student_id, title: "Assignment ready 📄", body: "You can now download your file.", link: `/payment/${p.assignment_id}` },
      { user_id: p.writer_id, title: "File released", body: `Send ₹${p.writer_payout} payout to writer's UPI now.`, link: `/admin` },
    ]);
    toast.success("File released to student");
    qc.invalidateQueries({ queryKey: ["admin-payments"] });
    qc.invalidateQueries({ queryKey: ["admin-files"] });
  };

  const viewScreenshot = async (path: string) => {
    const { data } = await supabase.storage.from("assignment-files").createSignedUrl(path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="px-4 pt-6 pb-4">
      <h1 className="text-2xl font-bold mb-1">Admin</h1>
      <p className="text-sm text-muted-foreground mb-4">Profits, payments & releases</p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Stat icon={TrendingUp} label="Total revenue" value={totalRevenue} tone="primary" />
        <Stat icon={Wallet} label="Your profit (15%)" value={totalProfit} tone="success" />
        <Stat icon={IndianRupee} label="Writer payouts (85%)" value={totalPayouts} tone="muted" />
        <Stat icon={Clock} label="Pending verify" value={pendingVerify} tone="warning" raw />
      </div>

      <h2 className="font-bold mb-2">All payments</h2>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="space-y-3">
        {payments?.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No payments yet</p>}
        {payments?.map((p) => {
          const f = fileForBid(p.bid_id);
          return (
            <div key={p.id} className="rounded-2xl bg-card border border-border p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{p.assignment?.title}</p>
                  <p className="text-xs text-muted-foreground">{p.assignment?.subject}</p>
                </div>
                <StatusBadge status={p.status} />
              </div>

              <div className="grid grid-cols-3 gap-2 my-3 text-xs">
                <div className="bg-muted/50 rounded-lg p-2"><p className="text-muted-foreground">Total</p><p className="font-bold flex items-center"><IndianRupee className="h-3 w-3" />{p.amount}</p></div>
                <div className="bg-success/10 rounded-lg p-2"><p className="text-muted-foreground">Profit</p><p className="font-bold text-success flex items-center"><IndianRupee className="h-3 w-3" />{p.commission}</p></div>
                <div className="bg-muted/50 rounded-lg p-2"><p className="text-muted-foreground">Writer</p><p className="font-bold flex items-center"><IndianRupee className="h-3 w-3" />{p.writer_payout}</p></div>
              </div>

              <div className="text-xs space-y-1 mb-3">
                <p><span className="text-muted-foreground">Student:</span> {p.student?.display_name}</p>
                <p><span className="text-muted-foreground">Writer:</span> {p.writer?.display_name} {p.writer?.upi_id && <span className="font-mono text-primary">· {p.writer.upi_id}</span>}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {p.screenshot_url && (
                  <Button size="sm" variant="outline" onClick={() => viewScreenshot(p.screenshot_url!)}>
                    <Eye className="h-3.5 w-3.5 mr-1" />Screenshot
                  </Button>
                )}
                {p.status === "awaiting_payment" && p.screenshot_url && (
                  <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground" onClick={() => markReceived(p)}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Mark received
                  </Button>
                )}
                {f && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />{f.file_name} {f.released && "(released)"}
                  </span>
                )}
                {p.status === "payment_received" && f && !f.released && (
                  <Button size="sm" className="bg-gradient-primary" onClick={() => releaseFile(p)}>
                    Release file
                  </Button>
                )}
                <Link to="/assignment/$id" params={{ id: p.assignment_id }}>
                  <Button size="sm" variant="ghost"><ExternalLink className="h-3.5 w-3.5" /></Button>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone, raw }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; tone: string; raw?: boolean }) {
  const colors: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    muted: "bg-muted text-foreground",
    warning: "bg-warning/10 text-warning",
  };
  return (
    <div className="rounded-2xl bg-card border border-border p-3 shadow-card">
      <div className={`inline-flex items-center justify-center h-7 w-7 rounded-full ${colors[tone]}`}><Icon className="h-3.5 w-3.5" /></div>
      <p className="text-xs text-muted-foreground mt-2">{label}</p>
      <p className="text-lg font-bold flex items-center">
        {!raw && <IndianRupee className="h-4 w-4" />}{value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    awaiting_payment: { label: "Awaiting", cls: "bg-warning/15 text-warning" },
    payment_received: { label: "Paid", cls: "bg-primary/15 text-primary" },
    file_delivered: { label: "Delivered", cls: "bg-success/15 text-success" },
    cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground" },
  };
  const x = map[status] ?? map.awaiting_payment;
  return <span className={`text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${x.cls}`}>{x.label}</span>;
}
