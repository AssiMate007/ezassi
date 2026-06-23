import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-admin";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  IndianRupee, CheckCircle2, Clock, FileText, ExternalLink, ShieldAlert,
  Wallet, TrendingUp, Eye, Users, Activity, Trophy, Sparkles,
  Search, Ban, RotateCcw, Bell, XCircle, RefreshCw, Zap,
  Download, Image as ImageIcon, ThumbsUp, ThumbsDown, Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

export const Route = createFileRoute("/_app/admin")({
  component: AdminPage,
});

interface PaymentRow {
  id: string; assignment_id: string; bid_id: string;
  student_id: string; writer_id: string;
  amount: number; commission: number; writer_payout: number;
  screenshot_url: string | null;
  status: "awaiting_payment" | "payment_received" | "file_delivered" | "cancelled";
  created_at: string; payment_received_at: string | null; released_at: string | null;
  assignment: { id: string; title: string; subject: string; description: string } | null;
  student: { display_name: string; upi_id: string | null } | null;
  writer: { display_name: string; upi_id: string | null } | null;
}
interface FileRow {
  id: string; assignment_id: string; bid_id: string;
  storage_path: string; file_name: string; file_size: number; released: boolean; created_at: string;
}
interface ProfileRow {
  id: string; display_name: string; role: string; created_at: string;
  rating: number; jobs_completed: number; upi_id: string | null; is_banned?: boolean;
}
interface AssignmentRow {
  id: string; student_id: string; title: string; description: string; subject: string;
  budget_min: number; budget_max: number; deadline: string; status: string; created_at: string;
  student: { display_name: string } | null;
  bids: { count: number }[];
}

const CHART_COLORS = ["var(--primary)","var(--success)","var(--warning)","var(--muted-foreground)"];

/* ── Modal: Reject Payment ─────────────────────────────────────── */
function RejectPaymentModal({ payment, onClose, onConfirm }: {
  payment: PaymentRow;
  onClose: () => void;
  onConfirm: (refundPct: number, reason: string) => void;
}) {
  const [refundPct, setRefundPct] = useState(100);
  const refundAmount = Math.round(payment.amount * refundPct / 100);
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-card rounded-3xl p-6 w-full max-w-sm shadow-glow-lg border border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Reject Payment</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="bg-destructive/10 rounded-2xl px-4 py-3 mb-4">
          <p className="text-sm font-semibold text-destructive">₹{payment.amount} from {payment.student?.display_name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{payment.assignment?.title}</p>
        </div>
        <div className="space-y-3 mb-5">
          <div>
            <label className="text-sm font-semibold block mb-1.5">Refund percentage</label>
            <div className="flex items-center gap-3">
              <input type="range" min={0} max={100} step={5} value={refundPct}
                onChange={e => setRefundPct(+e.target.value)}
                className="flex-1 accent-primary" />
              <span className="text-primary font-bold w-12 text-right">{refundPct}%</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>No refund</span>
              <span className="font-semibold text-foreground">Refund: ₹{refundAmount}</span>
              <span>Full refund</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[0, 50, 100].map(v => (
              <button key={v} onClick={() => setRefundPct(v)}
                className={`py-2 rounded-xl text-sm font-medium border transition ${refundPct === v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                {v === 0 ? "No refund" : v === 50 ? "50%" : "Full"}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-2xl">Cancel</Button>
          <Button onClick={() => onConfirm(refundPct, "")} className="rounded-2xl bg-destructive hover:bg-destructive/90 text-destructive-foreground">
            Reject & notify
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Modal: Reject File ────────────────────────────────────────── */
function RejectFileModal({ payment, onClose, onConfirm }: {
  payment: PaymentRow;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-card rounded-3xl p-6 w-full max-w-sm shadow-glow-lg border border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Reject File</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="bg-warning/10 rounded-2xl px-4 py-3 mb-4 text-warning">
          <p className="text-sm font-semibold">Writer will be asked to re-upload</p>
          <p className="text-xs text-muted-foreground mt-0.5 text-foreground">{payment.assignment?.title}</p>
        </div>
        <div className="space-y-3 mb-5">
          <div>
            <label className="text-sm font-semibold block mb-1.5">Reason for rejection (sent to writer)</label>
            <Textarea rows={3} placeholder="e.g. The file is incomplete, missing pages 3-5. Please re-upload the full version."
              value={reason} onChange={e => setReason(e.target.value)}
              className="rounded-xl resize-none" />
          </div>
          <div className="flex flex-wrap gap-2">
            {["File is incomplete","Wrong format","Doesn't match brief","Quality too low"].map(r => (
              <button key={r} onClick={() => setReason(r)}
                className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:border-primary/40 hover:text-primary transition">
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-2xl">Cancel</Button>
          <Button onClick={() => onConfirm(reason)} className="rounded-2xl bg-warning hover:bg-warning/90 text-warning-foreground">
            Reject & notify writer
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Modal: Screenshot Preview ─────────────────────────────────── */
function ImagePreviewModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
      onClick={onClose}>
      <div className="relative w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <button onClick={onClose}
          className="absolute -top-4 -right-4 h-9 w-9 rounded-full bg-card border border-border flex items-center justify-center font-bold shadow-soft z-10">
          <X className="h-4 w-4" />
        </button>
        <img src={url} alt="Payment receipt" className="w-full rounded-2xl shadow-glow-lg border border-border/20" />
        <a href={url} target="_blank" rel="noreferrer"
          className="mt-3 flex items-center justify-center gap-2 text-white/70 text-xs hover:text-white transition">
          <ExternalLink className="h-3.5 w-3.5" />Open full size
        </a>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */

function AdminPage() {
  const isAdmin = useIsAdmin();
  const { user } = useAuth();
  const qc = useQueryClient();

  // Modal states
  const [rejectPaymentTarget, setRejectPaymentTarget] = useState<PaymentRow | null>(null);
  const [rejectFileTarget,    setRejectFileTarget]    = useState<PaymentRow | null>(null);
  const [previewUrl,          setPreviewUrl]          = useState<string | null>(null);
  const [openingFile,         setOpeningFile]         = useState<string | null>(null);

  const [dismissedAssignments, setDismissedAssignments] = useState<Set<string>>(new Set());
  // Tools state
  const [userSearch,   setUserSearch]   = useState("");
  const [notifTarget,  setNotifTarget]  = useState("");
  const [notifTitle,   setNotifTitle]   = useState("");
  const [notifBody,    setNotifBody]    = useState("");
  const [sendingNotif, setSendingNotif] = useState(false);
  const [lastRefresh,  setLastRefresh]  = useState(new Date());

  /* ── Queries ──────────────────────────────────────────────────── */
  const refetchAll = () => {
    ["admin-payments","admin-files","admin-profiles","admin-assignments","admin-bids"]
      .forEach(k => qc.invalidateQueries({ queryKey: [k] }));
    setLastRefresh(new Date());
    toast.success("Refreshed ✓");
  };

  const { data: payments, isLoading: paymentsLoading, refetch: refetchPayments } = useQuery({
    queryKey: ["admin-payments"], enabled: !!user, staleTime: 0, refetchInterval: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("payments")
        .select("*, assignment:assignments(id,title,subject,description), student:profiles!payments_student_id_fkey(display_name,upi_id), writer:profiles!payments_writer_id_fkey(display_name,upi_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PaymentRow[];
    },
  });

  const { data: files, refetch: refetchFiles } = useQuery({
    queryKey: ["admin-files"], enabled: !!user, staleTime: 0, refetchInterval: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("assignment_files")
        .select("id,assignment_id,bid_id,storage_path,file_name,file_size,released,created_at");
      if (error) return [];
      return (data ?? []) as FileRow[];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles"], enabled: !!user, staleTime: 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      return (data ?? []) as ProfileRow[];
    },
  });

  const { data: allAssignments, refetch: refetchAssignments } = useQuery({
    queryKey: ["admin-assignments"], enabled: !!user, staleTime: 0, refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("assignments")
        .select("id,student_id,title,description,subject,budget_min,budget_max,deadline,status,created_at, student:profiles!assignments_student_id_fkey(display_name), bids(count)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AssignmentRow[];
    },
  });

  const { data: bids } = useQuery({
    queryKey: ["admin-bids"], enabled: !!user, staleTime: 0,
    queryFn: async () => (await supabase.from("bids").select("id,created_at,amount,status")).data ?? [],
  });

  /* ── Realtime ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (!isAdmin) return;
    const ch = supabase.channel("admin-rt-v5")
      .on("postgres_changes", { event:"*", schema:"public", table:"payments" },         () => { qc.invalidateQueries({ queryKey: ["admin-payments"] });    refetchPayments(); })
      .on("postgres_changes", { event:"*", schema:"public", table:"assignment_files" }, () => { qc.invalidateQueries({ queryKey: ["admin-files"] });        refetchFiles(); })
      .on("postgres_changes", { event:"*", schema:"public", table:"profiles" },         () => { qc.invalidateQueries({ queryKey: ["admin-profiles"] }); })
      .on("postgres_changes", { event:"*", schema:"public", table:"assignments" },      () => { qc.invalidateQueries({ queryKey: ["admin-assignments"] }); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin, qc]);

  /* ── Stats ────────────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const paid = payments?.filter(p => p.status !== "awaiting_payment" && p.status !== "cancelled") ?? [];
    return {
      revenue:      paid.reduce((s,p) => s+p.amount, 0),
      profit:       paid.reduce((s,p) => s+p.commission, 0),
      payouts:      paid.reduce((s,p) => s+p.writer_payout, 0),
      pendingVerify: payments?.filter(p => p.status==="awaiting_payment" && p.screenshot_url).length ?? 0,
      users:        profiles?.length ?? 0,
      newUsers7:    profiles?.filter(p => Date.now()-new Date(p.created_at).getTime()<7*86400e3).length ?? 0,
      openJobs:     allAssignments?.filter(a => a.status==="open").length ?? 0,
      pendingFiles: files?.filter(f => !f.released).length ?? 0,
    };
  }, [payments, profiles, allAssignments, files]);

  const series = useMemo(() => Array.from({length:14}, (_,i) => {
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-(13-i));
    const next = new Date(d); next.setDate(next.getDate()+1);
    const inRange = (iso:string) => { const t=new Date(iso).getTime(); return t>=d.getTime()&&t<next.getTime(); };
    const paysIn = payments?.filter(p => p.payment_received_at && inRange(p.payment_received_at)) ?? [];
    return {
      label: d.toLocaleDateString(undefined,{month:"short",day:"numeric"}),
      users: profiles?.filter(p => inRange(p.created_at)).length ?? 0,
      revenue: paysIn.reduce((s,p)=>s+p.amount,0),
      profit:  paysIn.reduce((s,p)=>s+p.commission,0),
    };
  }), [profiles, payments]);

  const statusPie = useMemo(() => {
    const b:Record<string,number>={awaiting_payment:0,payment_received:0,file_delivered:0,cancelled:0};
    payments?.forEach(p=>{b[p.status]=(b[p.status]??0)+1;});
    return [{name:"Awaiting",value:b.awaiting_payment},{name:"Paid",value:b.payment_received},{name:"Done",value:b.file_delivered},{name:"Cancelled",value:b.cancelled}].filter(x=>x.value>0);
  }, [payments]);

  const topWriters = useMemo(() => {
    const map=new Map<string,{name:string;jobs:number;earned:number}>();
    payments?.filter(p=>p.status==="file_delivered").forEach(p=>{
      const prev=map.get(p.writer_id)??{name:p.writer?.display_name??"Writer",jobs:0,earned:0};
      prev.jobs++;prev.earned+=p.writer_payout;map.set(p.writer_id,prev);
    });
    return [...map.values()].sort((a,b)=>b.earned-a.earned).slice(0,5);
  }, [payments]);

  const filteredProfiles = useMemo(() => {
    if (!userSearch.trim()) return profiles??[];
    const q=userSearch.toLowerCase();
    return (profiles??[]).filter(p=>p.display_name.toLowerCase().includes(q)||p.role.includes(q)||(p.upi_id??"").includes(q));
  }, [profiles, userSearch]);

  if (!isAdmin) return (
    <div className="p-8 text-center">
      <ShieldAlert className="h-12 w-12 text-muted-foreground mx-auto mb-3"/>
      <p className="font-semibold">Admin access only</p>
      <Link to="/admin-auth" className="inline-flex items-center gap-2 mt-4 bg-gradient-primary text-primary-foreground px-5 py-2.5 rounded-2xl font-medium text-sm">Go to Admin Login</Link>
    </div>
  );

  /* ── Helpers ──────────────────────────────────────────────────── */
  const fileForPayment = (p:PaymentRow) => files?.find(f=>f.bid_id===p.bid_id||f.assignment_id===p.assignment_id);

  const getSignedUrl = async (path:string): Promise<string|null> => {
    const {data,error} = await supabase.storage.from("assignment-files").createSignedUrl(path,3600);
    if (error||!data?.signedUrl) { toast.error(`Cannot open file: ${error?.message}`); return null; }
    return data.signedUrl;
  };

  const previewReceipt = async (path:string) => {
    setOpeningFile(path);
    const url = await getSignedUrl(path);
    setOpeningFile(null);
    if (!url) return;
    // Always show in lightbox so admin can review inline
    setPreviewUrl(url);
  };

  const downloadFile = async (path:string) => {
    setOpeningFile(path);
    const url = await getSignedUrl(path);
    setOpeningFile(null);
    if (!url) return;
    // Open in new tab so admin can review the assignment
    window.open(url, "_blank");
  };

  /* ── Payment actions ──────────────────────────────────────────── */
  const approvePayment = async (p:PaymentRow) => {
    const {error} = await supabase.from("payments")
      .update({status:"payment_received", payment_received_at:new Date().toISOString()}).eq("id",p.id);
    if (error) return toast.error("Could not update payment: " + error.message);
    // Notify STUDENT: payment verified
    await supabase.from("notifications").insert({
      user_id: p.student_id,
      title: "✅ Payment verified!",
      body: `Your ₹${p.amount} payment for "${p.assignment?.title}" has been confirmed. The writer will now upload your assignment.`,
      link: `/payment/${p.assignment_id}`,
    });
    // Notify WRITER: payment received, start working
    await supabase.from("notifications").insert({
      user_id: p.writer_id,
      title: "🎉 Payment received — start working!",
      body: `₹${p.amount} payment confirmed for "${p.assignment?.title}". Please upload the completed assignment now.`,
      link: `/assignment/${p.assignment_id}`,
    });
    toast.success("✅ Payment approved — student & writer notified!");
    qc.invalidateQueries({queryKey:["admin-payments"]});
    await refetchPayments();
  };

  const handleRejectPayment = async (refundPct:number, _reason:string) => {
    if (!rejectPaymentTarget) return;
    const p = rejectPaymentTarget;
    const refundAmount = Math.round(p.amount * refundPct / 100);
    await supabase.from("payments").update({status:"cancelled"}).eq("id",p.id);
    await supabase.from("notifications").insert([
      {
        user_id: p.student_id,
        title: "Payment rejected ❌",
        body: refundPct > 0
          ? `Your payment of ₹${p.amount} was rejected. A refund of ₹${refundAmount} (${refundPct}%) will be processed to your UPI.`
          : `Your payment of ₹${p.amount} was rejected. No refund will be issued.`,
        link: `/payment/${p.assignment_id}`,
      },
      {
        user_id: p.writer_id,
        title: "Payment rejected",
        body: `The ₹${p.amount} payment for "${p.assignment?.title}" was rejected by admin.`,
        link: `/assignment/${p.assignment_id}`,
      },
    ]);
    toast.success(`Payment rejected — student notified${refundPct>0?` (₹${refundAmount} refund)`:" (no refund)"}`);
    setRejectPaymentTarget(null);
    qc.invalidateQueries({queryKey:["admin-payments"]});
    await refetchPayments();
  };

  const approveFile = async (p:PaymentRow) => {
    const f = fileForPayment(p);
    if (!f) return toast.error("No file uploaded yet — writer hasn't uploaded");
    // Step 1: Release file so student can download
    const {error:fErr} = await supabase.from("assignment_files").update({released:true}).eq("id",f.id);
    if (fErr) return toast.error("Could not release file: " + fErr.message);
    // Step 2: Mark payment complete
    const {error:pErr} = await supabase.from("payments")
      .update({status:"file_delivered", released_at:new Date().toISOString()}).eq("id",p.id);
    if (pErr) return toast.error("Could not update payment: " + pErr.message);
    // Step 3: Mark assignment completed
    await supabase.from("assignments").update({status:"completed"}).eq("id",p.assignment_id);
    // Step 4: Notify STUDENT — they can now download
    await supabase.from("notifications").insert({
      user_id: p.student_id,
      title: "✅ Your assignment is ready!",
      body: `The file for "${p.assignment?.title}" has been verified and released. Tap to download now.`,
      link: `/payment/${p.assignment_id}`,
    });
    // Step 5: Notify WRITER — job complete, they get paid
    await supabase.from("notifications").insert({
      user_id: p.writer_id,
      title: "💸 Job complete — you get paid!",
      body: `File approved for "${p.assignment?.title}". You will receive ₹${p.writer_payout} on your UPI${p.writer?.upi_id ? `: ${p.writer.upi_id}` : " (set your UPI in Profile to receive payment)"}.`,
      link: `/assignment/${p.assignment_id}`,
    });
    toast.success("✅ File released to student — both parties notified!");
    qc.invalidateQueries({queryKey:["admin-payments"]});
    qc.invalidateQueries({queryKey:["admin-files"]});
    await refetchPayments();
    await refetchFiles();
  };

  const handleRejectFile = async (reason:string) => {
    if (!rejectFileTarget) return;
    const p = rejectFileTarget;
    const f = fileForPayment(p);
    if (f) await supabase.from("assignment_files").delete().eq("id",f.id);
    // Reset payment back to payment_received so writer can re-upload
    await supabase.from("payments").update({status:"payment_received"}).eq("id",p.id);
    // Notify WRITER to re-upload
    await supabase.from("notifications").insert({
      user_id: p.writer_id,
      title: "❌ File rejected — please re-upload",
      body: reason
        ? `Admin rejected your file for "${p.assignment?.title}": "${reason}". Please go to the assignment page and upload a corrected version.`
        : `Admin rejected your file for "${p.assignment?.title}". Please upload a corrected version.`,
      link: `/assignment/${p.assignment_id}`,
    });
    // Notify STUDENT to wait
    await supabase.from("notifications").insert({
      user_id: p.student_id,
      title: "⏳ Assignment being revised",
      body: `The writer has been asked to revise their submission for "${p.assignment?.title}". You'll be notified as soon as the new version is ready.`,
      link: `/payment/${p.assignment_id}`,
    });
    toast.success("File rejected — writer notified to re-upload");
    setRejectFileTarget(null);
    qc.invalidateQueries({queryKey:["admin-files"]});
    qc.invalidateQueries({queryKey:["admin-payments"]});
    await refetchFiles();
    await refetchPayments();
  };

  /* ── Assignment actions ───────────────────────────────────────── */
  const approveAssignment = async (a:AssignmentRow) => {
    await supabase.from("notifications").insert({
      user_id: a.student_id,
      title: "Assignment approved ✓",
      body: `Your assignment "${a.title}" has been reviewed and is now live for writers to bid on!`,
      link: `/assignment/${a.id}`,
    });
    // Dismiss from admin queue immediately (local state)
    setDismissedAssignments(prev => new Set([...prev, a.id]));
    toast.success("Assignment approved ✓ — removed from queue");
  };

  const removeAssignment = async (a:AssignmentRow) => {
    if (!confirm(`Remove "${a.title}"?`)) return;
    await supabase.from("assignments").update({status:"cancelled"}).eq("id",a.id);
    await supabase.from("notifications").insert({
      user_id: a.student_id,
      title: "Assignment removed",
      body: `Your assignment "${a.title}" was removed by admin.`,
      link: "/feed",
    });
    toast.success("Assignment removed — student notified");
    setDismissedAssignments(prev => new Set([...prev, a.id]));
    qc.invalidateQueries({queryKey:["admin-assignments"]});
    refetchAssignments();
  };

  /* ── User actions ─────────────────────────────────────────────── */
  const toggleBan = async (u:ProfileRow) => {
    if (!confirm(`${u.is_banned?"Unban":"Ban"} ${u.display_name}?`)) return;
    await supabase.from("profiles").update({is_banned:!u.is_banned}).eq("id",u.id);
    await supabase.from("notifications").insert({
      user_id: u.id,
      title: u.is_banned ? "Account restored" : "Account suspended",
      body: u.is_banned ? "Your account has been restored by admin." : "Your account has been suspended by admin. Contact support.",
      link: "/feed",
    });
    toast.success(`${u.display_name} ${u.is_banned?"unbanned":"banned"}`);
    qc.invalidateQueries({queryKey:["admin-profiles"]});
  };

  /* ── Notifications ────────────────────────────────────────────── */
  const sendNotif = async () => {
    const title=notifTitle.trim(), body=notifBody.trim();
    if (!title) return toast.error("Title required");
    if (!body)  return toast.error("Message required");
    setSendingNotif(true);
    try {
      const {data:allP,error} = await supabase.from("profiles").select("id,display_name");
      if (error) throw error;
      if (!allP?.length) throw new Error("No users found");
      const targets = notifTarget.trim() ? allP.filter(p=>p.display_name.toLowerCase().includes(notifTarget.toLowerCase())) : allP;
      if (!targets.length) return toast.error(`No users matching "${notifTarget}"`);
      const rows = targets.map(p=>({user_id:p.id,title,body,link:"/feed"}));
      for (let i=0;i<rows.length;i+=100) {
        const {error:e} = await supabase.from("notifications").insert(rows.slice(i,i+100));
        if (e) throw e;
      }
      toast.success(`✅ Sent to ${targets.length} user${targets.length!==1?"s":""}`);
      setNotifTitle(""); setNotifBody(""); setNotifTarget("");
    } catch(err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setSendingNotif(false); }
  };

  /* ── Counts ───────────────────────────────────────────────────── */
  const actionableCount = payments?.filter(p => {
    const f=fileForPayment(p);
    return (p.status==="awaiting_payment"&&p.screenshot_url)||(p.status==="payment_received"&&f&&!f.released);
  }).length??0;

  /* ══════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-zinc-50/50 pb-12 dark:bg-zinc-950">
      {/* Modals */}
      {rejectPaymentTarget && <RejectPaymentModal payment={rejectPaymentTarget} onClose={()=>setRejectPaymentTarget(null)} onConfirm={handleRejectPayment} />}
      {rejectFileTarget    && <RejectFileModal    payment={rejectFileTarget}    onClose={()=>setRejectFileTarget(null)}    onConfirm={handleRejectFile} />}
      {previewUrl          && <ImagePreviewModal  url={previewUrl}              onClose={()=>setPreviewUrl(null)} />}

      {/* Header — matches Feed page structure */}
      <header className="border-b border-zinc-100 bg-white px-4 pt-10 pb-8 dark:border-zinc-900 dark:bg-zinc-900/20">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Admin HQ</p>
              <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                <Sparkles className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
                Dashboard
              </h1>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />Live · auto-refresh every 10s
              </p>
            </div>
            <button onClick={refetchAll}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white shadow-sm transition-all hover:bg-zinc-800 active:scale-[0.98] dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200">
              <RefreshCw className="h-3.5 w-3.5"/>Refresh
            </button>
          </div>
          <div className="mt-5 flex gap-2 flex-wrap">
            {[["Profit",`₹${stats.profit.toLocaleString()}`],[`Users`,stats.users],[`Open`,stats.openJobs]].map(([l,v])=>(
              <div key={l} className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                <div><p className="text-[10px] text-zinc-400 dark:text-zinc-500">{l}</p><p className="font-bold leading-none text-zinc-900 dark:text-zinc-50 text-sm">{v}</p></div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-6">
        {actionableCount>0 && (
          <div className="mb-4 flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-amber-700 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-400">
            <Zap className="h-4 w-4 shrink-0 animate-pulse"/>
            <p className="text-sm font-semibold">{actionableCount} item{actionableCount>1?"s":""} need your review now</p>
          </div>
        )}

        <Tabs defaultValue="review">
          <TabsList className="grid grid-cols-5 w-full rounded-xl border border-zinc-200 bg-white p-1 mb-5 dark:border-zinc-800 dark:bg-zinc-900">
            <TabsTrigger value="overview"    className="rounded-lg text-[11px] data-[state=active]:bg-zinc-900 data-[state=active]:text-white dark:data-[state=active]:bg-zinc-100 dark:data-[state=active]:text-zinc-950">Overview</TabsTrigger>
            <TabsTrigger value="review"      className="rounded-lg text-[11px] relative data-[state=active]:bg-zinc-900 data-[state=active]:text-white dark:data-[state=active]:bg-zinc-100 dark:data-[state=active]:text-zinc-950">
              Review
              {actionableCount>0&&<span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-amber-500 text-[8px] font-bold flex items-center justify-center text-white">{actionableCount}</span>}
            </TabsTrigger>
            <TabsTrigger value="assignments" className="rounded-lg text-[11px] data-[state=active]:bg-zinc-900 data-[state=active]:text-white dark:data-[state=active]:bg-zinc-100 dark:data-[state=active]:text-zinc-950">Jobs</TabsTrigger>
            <TabsTrigger value="users"       className="rounded-lg text-[11px] data-[state=active]:bg-zinc-900 data-[state=active]:text-white dark:data-[state=active]:bg-zinc-100 dark:data-[state=active]:text-zinc-950">Users</TabsTrigger>
            <TabsTrigger value="tools"       className="rounded-lg text-[11px] data-[state=active]:bg-zinc-900 data-[state=active]:text-white dark:data-[state=active]:bg-zinc-100 dark:data-[state=active]:text-zinc-950">Tools</TabsTrigger>
          </TabsList>

          {/* ══ OVERVIEW ══ */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-gradient-primary p-4 text-primary-foreground shadow-glow">
                <IndianRupee className="h-4 w-4 opacity-75 mb-1"/>
                <p className="text-xs opacity-75">Revenue</p>
                <p className="text-xl font-bold">₹{stats.revenue.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl bg-gradient-teal p-4 text-white shadow-soft">
                <Wallet className="h-4 w-4 opacity-75 mb-1"/>
                <p className="text-xs opacity-75">Writer payouts</p>
                <p className="text-xl font-bold">₹{stats.payouts.toLocaleString()}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Stat icon={Activity} label="Open jobs"  value={stats.openJobs.toString()}      tone="success"/>
              <Stat icon={Clock}    label="Pending"    value={stats.pendingVerify.toString()}  tone="warning"/>
              <Stat icon={Users}    label="New/7d"     value={stats.newUsers7.toString()}      tone="primary"/>
            </div>
            <ChartCard title="Revenue & profit — 14 days" icon={TrendingUp}>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={series} margin={{left:-20,right:5,top:5}}>
                  <defs>
                    <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4}/><stop offset="100%" stopColor="var(--primary)" stopOpacity={0}/></linearGradient>
                    <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--success)" stopOpacity={0.4}/><stop offset="100%" stopColor="var(--success)" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                  <XAxis dataKey="label" tick={{fontSize:9}} stroke="var(--muted-foreground)"/>
                  <YAxis tick={{fontSize:9}} stroke="var(--muted-foreground)"/>
                  <Tooltip contentStyle={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:10,fontSize:11}}/>
                  <Area type="monotone" dataKey="revenue" stroke="var(--primary)" fill="url(#gR)" strokeWidth={2}/>
                  <Area type="monotone" dataKey="profit"  stroke="var(--success)" fill="url(#gP)" strokeWidth={2}/>
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="New signups — 14 days" icon={Users}>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={series} margin={{left:-20,right:5,top:5}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                  <XAxis dataKey="label" tick={{fontSize:9}} stroke="var(--muted-foreground)"/>
                  <YAxis tick={{fontSize:9}} stroke="var(--muted-foreground)" allowDecimals={false}/>
                  <Tooltip contentStyle={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:10,fontSize:11}}/>
                  <Bar dataKey="users" fill="var(--primary)" radius={[5,5,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            {statusPie.length>0&&(
              <ChartCard title="Payment status mix" icon={Wallet}>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={statusPie} dataKey="value" nameKey="name" outerRadius={58} innerRadius={30} paddingAngle={3}>
                      {statusPie.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}
                    </Pie>
                    <Tooltip contentStyle={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:10,fontSize:11}}/>
                    <Legend wrapperStyle={{fontSize:10}}/>
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
            {topWriters.length>0&&(
              <div className="rounded-2xl bg-card border border-border p-4 shadow-card">
                <div className="flex items-center gap-2 mb-3"><Trophy className="h-4 w-4 text-warning"/><h3 className="font-bold text-sm">Top writers</h3></div>
                <div className="space-y-3">
                  {topWriters.map((w,i)=>(
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i===0?"bg-gradient-warm text-white":"bg-muted"}`}>{i+1}</span>
                        <span className="text-sm font-medium">{w.name}</span>
                      </div>
                      <div className="text-right"><p className="font-bold text-sm text-success">₹{w.earned}</p><p className="text-[10px] text-muted-foreground">{w.jobs} jobs</p></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ══ REVIEW ══ */}
          <TabsContent value="review" className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-base">Review Payments & Files</h2>
              {paymentsLoading&&<RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground"/>}
            </div>
            {payments?.filter(p=>p.status!=="file_delivered"&&p.status!=="cancelled").length===0&&!paymentsLoading&&(
              <div className="text-center py-12 bg-card rounded-2xl border border-dashed border-border">
                <div className="text-4xl mb-2">✅</div><p className="text-sm font-semibold text-success">All clear!</p><p className="text-xs text-muted-foreground mt-1">No pending items to review</p>
              </div>
            )}
            <div className="space-y-4">
              {/* Only show active payments — done/cancelled are hidden */}
              {[...(payments??[])].filter(p=>p.status!=="file_delivered"&&p.status!=="cancelled").sort((a,b)=>{
                const score=(p:PaymentRow)=>{
                  const f=fileForPayment(p);
                  if(p.status==="awaiting_payment"&&p.screenshot_url) return 0;
                  if(p.status==="payment_received"&&f&&!f.released) return 1;
                  if(p.status==="awaiting_payment"&&!p.screenshot_url) return 2;
                  if(p.status==="payment_received") return 3;
                  return 4;
                };
                return score(a)-score(b);
              }).map(p=>{
                const f=fileForPayment(p);
                const needsVerify  = p.status==="awaiting_payment"&&!!p.screenshot_url;
                const noScreenshot = p.status==="awaiting_payment"&&!p.screenshot_url;
                const needsRelease = p.status==="payment_received"&&!!f&&!f.released;
                const waitingFile  = p.status==="payment_received"&&!f;

                return (
                  <div key={p.id} className={`rounded-3xl bg-card border p-5 shadow-card ${
                    needsVerify  ? "border-warning/60 ring-2 ring-warning/20" :
                    needsRelease ? "border-primary/50 ring-2 ring-primary/15" : "border-border"
                  }`}>
                    {needsVerify  && <Banner color="warning" icon={<ImageIcon className="h-4 w-4"/>}   text="Screenshot uploaded — review and approve or reject"/>}
                    {noScreenshot && <Banner color="muted"   icon={<Clock className="h-4 w-4"/>}        text="Waiting for student to upload payment screenshot"/>}
                    {needsRelease && <Banner color="primary" icon={<FileText className="h-4 w-4"/>}     text="Assignment file ready — review then approve or reject"/>}
                    {waitingFile  && <Banner color="muted"   icon={<Clock className="h-4 w-4"/>}        text="Payment confirmed — waiting for writer to upload file"/>}

                    {/* Title + status */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-base truncate">{p.assignment?.title??"Untitled"}</p>
                        <p className="text-xs text-muted-foreground">{p.assignment?.subject}</p>
                      </div>
                      <StatusBadge status={p.status}/>
                    </div>

                    {/* Description */}
                    {p.assignment?.description&&(
                      <p className="text-sm text-muted-foreground bg-muted/40 rounded-xl px-3 py-2.5 mb-3 line-clamp-3 leading-relaxed">{p.assignment.description}</p>
                    )}

                    {/* Money */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <MiniStat label="Total"       value={p.amount}/>
                      <MiniStat label="Profit 15%"  value={p.commission} tone="success"/>
                      <MiniStat label="Writer gets" value={p.writer_payout}/>
                    </div>

                    {/* Parties */}
                    <div className="bg-muted/40 rounded-xl px-3 py-2.5 mb-3 space-y-1.5 text-xs">
                      <Row label="Student" value={p.student?.display_name??"—"}/>
                      <Row label="Writer"  value={p.writer?.display_name??"—"}/>
                      {p.writer?.upi_id&&<Row label="Writer UPI" value={p.writer.upi_id} mono/>}
                      <Row label="Submitted" value={new Date(p.created_at).toLocaleString()}/>
                      {p.payment_received_at&&<Row label="Paid at" value={new Date(p.payment_received_at).toLocaleString()}/>}
                      {p.released_at&&<Row label="Released at" value={new Date(p.released_at).toLocaleString()}/>}
                    </div>

                    {/* ── PAYMENT RECEIPT SECTION ── */}
                    <div className="rounded-2xl border border-border p-3.5 mb-2.5 space-y-2.5">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">📄 Payment Receipt</p>
                      {p.screenshot_url ? (
                        <>
                          <Button size="sm" variant="outline" className="w-full rounded-xl h-9"
                            onClick={()=>previewReceipt(p.screenshot_url!)} disabled={openingFile===p.screenshot_url}>
                            {openingFile===p.screenshot_url ? <Loader2 className="h-4 w-4 animate-spin mr-1.5"/> : <ImageIcon className="h-4 w-4 mr-1.5"/>}
                            Preview payment screenshot
                          </Button>
                          {needsVerify&&(
                            <div className="grid grid-cols-2 gap-2">
                              <Button size="sm" className="rounded-xl h-10 bg-success hover:bg-success/90 text-success-foreground font-semibold"
                                onClick={()=>approvePayment(p)}>
                                <ThumbsUp className="h-4 w-4 mr-1.5"/>Approve
                              </Button>
                              <Button size="sm" variant="outline" className="rounded-xl h-10 border-destructive/40 text-destructive hover:bg-destructive/10 font-semibold"
                                onClick={()=>setRejectPaymentTarget(p)}>
                                <ThumbsDown className="h-4 w-4 mr-1.5"/>Reject
                              </Button>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground italic">No screenshot yet</p>
                          {noScreenshot&&(
                            <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs text-success border-success/40 hover:bg-success/10"
                              onClick={()=>{if(confirm(`Manually approve ₹${p.amount}?`))approvePayment(p);}}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1"/>Approve manually
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ── ASSIGNMENT FILE SECTION ── */}
                    <div className="rounded-2xl border border-border p-3.5 mb-2.5 space-y-2.5">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">📁 Assignment File</p>
                      {f ? (
                        <>
                          <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2">
                            <FileText className="h-4 w-4 text-primary shrink-0"/>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{f.file_name}</p>
                              <p className="text-[11px] text-muted-foreground">{(f.file_size/1024).toFixed(0)} KB · {new Date(f.created_at).toLocaleString()}</p>
                            </div>
                            {f.released&&<span className="text-[10px] text-success font-bold bg-success/10 px-2 py-0.5 rounded-full shrink-0">Released ✓</span>}
                          </div>
                          <Button size="sm" variant="outline" className="w-full rounded-xl h-9"
                            onClick={()=>downloadFile(f.storage_path)} disabled={openingFile===f.storage_path}>
                            {openingFile===f.storage_path ? <Loader2 className="h-4 w-4 animate-spin mr-1.5"/> : <Download className="h-4 w-4 mr-1.5"/>}
                            Download & review assignment
                          </Button>
                          {needsRelease ? (
                            <div className="grid grid-cols-2 gap-2">
                              <Button size="sm" className="rounded-xl h-10 bg-gradient-primary font-semibold"
                                onClick={()=>approveFile(p)}>
                                <ThumbsUp className="h-4 w-4 mr-1.5"/>Release to student
                              </Button>
                              <Button size="sm" variant="outline" className="rounded-xl h-10 border-warning/40 text-warning hover:bg-warning/10 font-semibold"
                                onClick={()=>setRejectFileTarget(p)}>
                                <ThumbsDown className="h-4 w-4 mr-1.5"/>Reject file
                              </Button>
                            </div>
                          ) : f.released ? (
                            <p className="text-xs text-success font-medium flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5"/>Released — moved to history</p>
                          ) : null}
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          {p.status==="awaiting_payment" ? "Confirm payment first, then writer will upload" : "Writer hasn't uploaded yet — they've been notified"}
                        </p>
                      )}
                    </div>

                    {/* Quick links */}
                    <div className="flex gap-2">
                      <Link to="/assignment/$id" params={{id:p.assignment_id}} className="flex-1">
                        <Button size="sm" variant="ghost" className="w-full rounded-xl h-8 text-xs text-muted-foreground">
                          <ExternalLink className="h-3.5 w-3.5 mr-1"/>View assignment page
                        </Button>
                      </Link>
                      {!needsVerify&&(
                        <Button size="sm" variant="ghost" className="rounded-xl h-8 text-xs text-destructive hover:bg-destructive/10"
                          onClick={()=>setRejectPaymentTarget(p)}>
                          <XCircle className="h-3.5 w-3.5 mr-1"/>Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* ══ ASSIGNMENTS ══ */}
          <TabsContent value="assignments" className="mt-4">
            <h2 className="font-bold text-base mb-3">All Assignments ({allAssignments?.length??0})</h2>
            <div className="space-y-3">
              {/* Only show active assignments — completed/cancelled are hidden */}
              {allAssignments?.filter(a=>a.status!=="completed"&&a.status!=="cancelled"&&!dismissedAssignments.has(a.id)).map(a=>(
                <div key={a.id} className="rounded-2xl bg-card border border-border p-4 shadow-card">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{a.subject} · by {a.student?.display_name}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap border ${
                      a.status==="open"?"bg-success/10 text-success border-success/30":
                      a.status==="in_progress"?"bg-primary/10 text-primary border-primary/30":
                      a.status==="completed"?"bg-muted text-muted-foreground border-border":
                      "bg-destructive/10 text-destructive border-destructive/30"
                    }`}>{a.status.replace("_"," ")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">{a.description}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                    <span>₹{a.budget_min}–{a.budget_max}</span>
                    <span>Due {new Date(a.deadline).toLocaleDateString()}</span>
                    <span>{(a.bids as any)?.[0]?.count??0} bids</span>
                  </div>
                  <div className="flex gap-2">
                    <Link to="/assignment/$id" params={{id:a.id}} className="flex-1">
                      <Button size="sm" variant="outline" className="w-full rounded-xl h-8 text-xs">
                        <Eye className="h-3.5 w-3.5 mr-1"/>View & manage
                      </Button>
                    </Link>
                    {a.status!=="cancelled"&&a.status!=="completed"&&(
                      <>
                        <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs text-success border-success/40 hover:bg-success/10"
                          onClick={()=>approveAssignment(a)}>
                          <ThumbsUp className="h-3.5 w-3.5"/>
                        </Button>
                        <Button size="sm" variant="ghost" className="rounded-xl h-8 text-xs text-destructive hover:bg-destructive/10"
                          onClick={()=>removeAssignment(a)}>
                          <XCircle className="h-3.5 w-3.5"/>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {allAssignments?.filter(a=>a.status!=="completed"&&a.status!=="cancelled"&&!dismissedAssignments.has(a.id)).length===0&&(
                <div className="text-center py-12 bg-card rounded-2xl border border-dashed border-border">
                  <div className="text-4xl mb-2">✅</div>
                  <p className="text-sm font-semibold text-success">All clear!</p>
                  <p className="text-xs text-muted-foreground mt-1">No active assignments</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ══ USERS ══ */}
          <TabsContent value="users" className="mt-4">
            <div className="relative mb-3">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
              <Input placeholder="Search name, role, UPI…" value={userSearch} onChange={e=>setUserSearch(e.target.value)} className="pl-10 rounded-2xl"/>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{filteredProfiles.length} users</p>
            <div className="space-y-2">
              {filteredProfiles.map(u=>(
                <div key={u.id} className={`rounded-2xl bg-card border p-3.5 flex items-center justify-between shadow-card ${u.is_banned?"border-destructive/30 bg-destructive/5":"border-border"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">{u.display_name}</p>
                      {u.is_banned&&<span className="text-[10px] bg-destructive/15 text-destructive px-1.5 py-0.5 rounded-full font-bold">Banned</span>}
                    </div>
                    <p className="text-[11px] text-muted-foreground capitalize">{u.role} · ★{Number(u.rating).toFixed(1)} · {u.jobs_completed} jobs</p>
                    {u.upi_id&&<p className="text-[10px] font-mono text-primary mt-0.5">{u.upi_id}</p>}
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</span>
                    <Button size="sm" variant="ghost" onClick={()=>toggleBan(u)}
                      className={`h-8 w-8 p-0 rounded-xl ${u.is_banned?"text-success hover:bg-success/10":"text-destructive hover:bg-destructive/10"}`}>
                      {u.is_banned?<RotateCcw className="h-3.5 w-3.5"/>:<Ban className="h-3.5 w-3.5"/>}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ══ TOOLS ══ */}
          <TabsContent value="tools" className="mt-4 space-y-4">
            <div className="rounded-2xl bg-card border border-border p-4 shadow-card space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-8 w-8 rounded-xl bg-gradient-primary flex items-center justify-center shadow-soft"><Bell className="h-4 w-4 text-primary-foreground"/></div>
                <div><h3 className="font-bold text-sm">Send notification</h3><p className="text-xs text-muted-foreground">Blank = send to everyone</p></div>
              </div>
              <Input placeholder="Target name (blank = all)" value={notifTarget} onChange={e=>setNotifTarget(e.target.value)} className="rounded-xl"/>
              <Input placeholder="Title" value={notifTitle} onChange={e=>setNotifTitle(e.target.value)} className="rounded-xl"/>
              <Input placeholder="Message body" value={notifBody} onChange={e=>setNotifBody(e.target.value)} className="rounded-xl"/>
              <Button className="w-full bg-gradient-primary rounded-xl" disabled={sendingNotif||!notifTitle.trim()||!notifBody.trim()} onClick={sendNotif}>
                {sendingNotif ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/>Sending…</span> : `Send to ${notifTarget.trim()?"matched users":"all users"}`}
              </Button>
            </div>
            <div className="rounded-2xl bg-gradient-soft border border-border p-4 shadow-card">
              <h3 className="font-bold text-sm mb-3">Platform stats</h3>
              {[["Net profit",`₹${stats.profit.toLocaleString()}`],["Total revenue",`₹${stats.revenue.toLocaleString()}`],["Writer payouts",`₹${stats.payouts.toLocaleString()}`],["Total users",stats.users],["Open assignments",stats.openJobs],["Files pending",stats.pendingFiles],["Last refresh",lastRefresh.toLocaleTimeString()]].map(([k,v])=>(
                <div key={k} className="flex justify-between items-center text-sm py-1.5 border-b border-border/40 last:border-0">
                  <span className="text-muted-foreground">{k}</span><span className="font-semibold">{v}</span>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

/* ── Small helpers ─────────────────────────────────────────────── */
function Row({label,value,mono}:{label:string;value:string;mono?:boolean}) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`font-medium text-right truncate ${mono?"font-mono text-primary text-[11px]":""}`}>{value}</span>
    </div>
  );
}
function Banner({color,icon,text}:{color:string;icon:React.ReactNode;text:string}) {
  const cls:Record<string,string>={warning:"bg-warning/10 text-warning border-warning/20",primary:"bg-primary/10 text-primary border-primary/20",success:"bg-success/10 text-success border-success/20",muted:"bg-muted/60 text-muted-foreground border-border"};
  return <div className={`mb-3 flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs font-semibold ${cls[color]}`}>{icon}{text}</div>;
}
function Stat({icon:Icon,label,value,tone}:{icon:React.ComponentType<{className?:string}>;label:string;value:string;tone:string}) {
  const colors:Record<string,string>={primary:"bg-primary/10 text-primary",success:"bg-success/10 text-success",muted:"bg-muted text-foreground",warning:"bg-warning/10 text-warning"};
  return (
    <div className="rounded-2xl bg-card border border-border p-3 shadow-card">
      <div className={`inline-flex items-center justify-center h-7 w-7 rounded-xl ${colors[tone]}`}><Icon className="h-3.5 w-3.5"/></div>
      <p className="text-xs text-muted-foreground mt-2">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
function MiniStat({label,value,tone}:{label:string;value:number;tone?:string}) {
  return (
    <div className={`rounded-xl p-2 ${tone==="success"?"bg-success/10":"bg-muted/50"}`}>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`font-bold text-sm flex items-center gap-0.5 ${tone==="success"?"text-success":""}`}><IndianRupee className="h-3 w-3"/>{value}</p>
    </div>
  );
}
function ChartCard({title,icon:Icon,children}:{title:string;icon:React.ComponentType<{className?:string}>;children:React.ReactNode}) {
  return (
    <div className="rounded-2xl bg-card border border-border p-3 shadow-card">
      <div className="flex items-center gap-2 mb-2 px-1"><Icon className="h-3.5 w-3.5 text-primary"/><h3 className="text-xs font-semibold">{title}</h3></div>
      {children}
    </div>
  );
}
function StatusBadge({status}:{status:string}) {
  const map:Record<string,{label:string;cls:string}>={
    awaiting_payment:{label:"Awaiting",cls:"bg-warning/15 text-warning border-warning/30"},
    payment_received:{label:"Paid ✓",cls:"bg-primary/15 text-primary border-primary/30"},
    file_delivered:{label:"Done ✓",cls:"bg-success/15 text-success border-success/30"},
    cancelled:{label:"Cancelled",cls:"bg-muted text-muted-foreground border-border"},
  };
  const x=map[status]??map.awaiting_payment;
  return <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap border ${x.cls}`}>{x.label}</span>;
}
