import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  IndianRupee, CheckCircle2, Clock, FileText, ExternalLink, ShieldAlert,
  Wallet, TrendingUp, Eye, Users, GraduationCap, PenLine, Activity, Trophy,
  Sparkles, Search, Ban, RotateCcw, Bell, XCircle, RefreshCw, Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

export const Route = createFileRoute("/_app/admin")({
  component: AdminPage,
});

interface PaymentRow {
  id: string; assignment_id: string; bid_id: string; student_id: string; writer_id: string;
  amount: number; commission: number; writer_payout: number;
  screenshot_url: string | null;
  status: "awaiting_payment" | "payment_received" | "file_delivered" | "cancelled";
  created_at: string; payment_received_at: string | null; released_at: string | null;
  assignment: { title: string; subject: string } | null;
  student: { display_name: string; upi_id: string | null } | null;
  writer: { display_name: string; upi_id: string | null } | null;
}

interface ProfileRow {
  id: string; display_name: string; role: "student" | "writer"; created_at: string;
  rating: number; jobs_completed: number; upi_id: string | null; is_banned?: boolean;
}

const CHART_COLORS = ["var(--primary)", "var(--success)", "var(--warning)", "var(--muted-foreground)"];

function AdminPage() {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const [userSearch, setUserSearch] = useState("");
  const [notifTarget, setNotifTarget] = useState("");
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");
  const [sendingNotif, setSendingNotif] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // FIX: manual refetch helper
  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: ["admin-payments"] });
    qc.invalidateQueries({ queryKey: ["admin-files"] });
    qc.invalidateQueries({ queryKey: ["admin-profiles"] });
    qc.invalidateQueries({ queryKey: ["admin-assignments"] });
    qc.invalidateQueries({ queryKey: ["admin-bids"] });
    setLastRefresh(new Date());
    toast.success("Refreshed");
  };

  const { data: payments, isLoading: paymentsLoading, refetch: refetchPayments } = useQuery({
    queryKey: ["admin-payments"],
    enabled: isAdmin,
    // FIX: no staleTime — always fresh
    staleTime: 0,
    refetchInterval: 15_000, // auto-refresh every 15s
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(`*, assignment:assignments(title,subject), student:profiles!payments_student_id_fkey(display_name,upi_id), writer:profiles!payments_writer_id_fkey(display_name,upi_id)`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PaymentRow[];
    },
  });

  const { data: files, refetch: refetchFiles } = useQuery({
    queryKey: ["admin-files"],
    enabled: isAdmin,
    staleTime: 0,
    refetchInterval: 15_000,
    queryFn: async () => (await supabase.from("assignment_files").select("*")).data ?? [],
  });

  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles"],
    enabled: isAdmin,
    staleTime: 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      return (data ?? []) as unknown as ProfileRow[];
    },
  });

  const { data: assignments } = useQuery({
    queryKey: ["admin-assignments"],
    enabled: isAdmin,
    staleTime: 0,
    queryFn: async () => (await supabase.from("assignments").select("id,status,created_at,budget_min,budget_max")).data ?? [],
  });

  const { data: bids } = useQuery({
    queryKey: ["admin-bids"],
    enabled: isAdmin,
    staleTime: 0,
    queryFn: async () => (await supabase.from("bids").select("id,created_at,amount,status")).data ?? [],
  });

  // FIX: Realtime subscriptions — properly invalidate and refetch
  useEffect(() => {
    if (!isAdmin) return;
    const ch = supabase
      .channel("admin-live-v2")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-payments"] });
        refetchPayments();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "assignment_files" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-files"] });
        refetchFiles();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-profiles"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "assignments" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-assignments"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "bids" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-bids"] });
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("Admin realtime: connected");
        }
      });
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin, qc, refetchPayments, refetchFiles]);

  const stats = useMemo(() => {
    const paid = payments?.filter((p) => p.status !== "awaiting_payment" && p.status !== "cancelled") ?? [];
    const revenue = paid.reduce((s, p) => s + p.amount, 0);
    const profit = paid.reduce((s, p) => s + p.commission, 0);
    const payouts = paid.reduce((s, p) => s + p.writer_payout, 0);
    const pendingVerify = payments?.filter((p) => p.status === "awaiting_payment" && p.screenshot_url).length ?? 0;
    const students = profiles?.filter((p) => p.role === "student").length ?? 0;
    const writers = profiles?.filter((p) => p.role === "writer").length ?? 0;
    const since7 = Date.now() - 7 * 86400e3;
    const newUsers7 = profiles?.filter((p) => new Date(p.created_at).getTime() > since7).length ?? 0;
    const openAssignments = assignments?.filter((a: any) => a.status === "open").length ?? 0;
    return { revenue, profit, payouts, pendingVerify, students, writers, newUsers7, openAssignments };
  }, [payments, profiles, assignments]);

  const series = useMemo(() => {
    const days: { label: string; users: number; revenue: number; profit: number; bids: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const inRange = (iso: string) => { const t = new Date(iso).getTime(); return t >= d.getTime() && t < next.getTime(); };
      const usersN = profiles?.filter((p) => inRange(p.created_at)).length ?? 0;
      const paysIn = payments?.filter((p) => (p.payment_received_at && inRange(p.payment_received_at)) || (!p.payment_received_at && inRange(p.created_at) && p.status !== "awaiting_payment" && p.status !== "cancelled")) ?? [];
      const rev = paysIn.reduce((s, p) => s + p.amount, 0);
      const prof = paysIn.reduce((s, p) => s + p.commission, 0);
      const bidsN = bids?.filter((b: any) => inRange(b.created_at)).length ?? 0;
      days.push({ label, users: usersN, revenue: rev, profit: prof, bids: bidsN });
    }
    return days;
  }, [profiles, payments, bids]);

  const statusPie = useMemo(() => {
    const b: Record<string, number> = { awaiting_payment: 0, payment_received: 0, file_delivered: 0, cancelled: 0 };
    payments?.forEach((p) => { b[p.status] = (b[p.status] ?? 0) + 1; });
    return [
      { name: "Awaiting", value: b.awaiting_payment },
      { name: "Paid", value: b.payment_received },
      { name: "Delivered", value: b.file_delivered },
      { name: "Cancelled", value: b.cancelled },
    ].filter((x) => x.value > 0);
  }, [payments]);

  const topWriters = useMemo(() => {
    const map = new Map<string, { name: string; jobs: number; earned: number }>();
    payments?.filter((p) => p.status === "file_delivered").forEach((p) => {
      const prev = map.get(p.writer_id) ?? { name: p.writer?.display_name ?? "Writer", jobs: 0, earned: 0 };
      prev.jobs += 1; prev.earned += p.writer_payout;
      map.set(p.writer_id, prev);
    });
    return [...map.values()].sort((a, b) => b.earned - a.earned).slice(0, 5);
  }, [payments]);

  const filteredProfiles = useMemo(() => {
    if (!userSearch.trim()) return profiles ?? [];
    const q = userSearch.toLowerCase();
    return (profiles ?? []).filter((p) =>
      p.display_name.toLowerCase().includes(q) || p.role.includes(q) || (p.upi_id ?? "").toLowerCase().includes(q)
    );
  }, [profiles, userSearch]);

  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <ShieldAlert className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="font-semibold">Admin access only</p>
        <p className="text-sm text-muted-foreground mt-1 mb-4">You need to be signed in as an admin.</p>
        <Link to="/admin-auth" className="inline-flex items-center gap-2 bg-gradient-primary text-primary-foreground px-5 py-2.5 rounded-2xl font-medium text-sm shadow-soft">
          Go to Admin Login
        </Link>
      </div>
    );
  }

  const fileForBid = (bid_id: string) => files?.find((f: any) => f.bid_id === bid_id);

  const markReceived = async (p: PaymentRow) => {
    const { error } = await supabase.from("payments")
      .update({ status: "payment_received", payment_received_at: new Date().toISOString() })
      .eq("id", p.id);
    if (error) return toast.error(error.message);
    await supabase.from("notifications").insert([
      { user_id: p.student_id, title: "Payment confirmed ✓", body: `Your payment of ₹${p.amount} is confirmed.`, link: `/payment/${p.assignment_id}` },
      { user_id: p.writer_id, title: "New paid job 🎉", body: `Student paid ₹${p.amount}. Please upload the assignment.`, link: `/assignment/${p.assignment_id}` },
    ]);
    toast.success("✓ Marked received & students notified");
    qc.invalidateQueries({ queryKey: ["admin-payments"] });
  };

  const releaseFile = async (p: PaymentRow) => {
    const f = fileForBid(p.bid_id);
    if (!f) return toast.error("No file uploaded yet by writer");
    const { error } = await supabase.from("assignment_files").update({ released: true }).eq("id", f.id);
    if (error) return toast.error(error.message);
    await supabase.from("payments").update({ status: "file_delivered", released_at: new Date().toISOString() }).eq("id", p.id);
    await supabase.from("notifications").insert([
      { user_id: p.student_id, title: "Assignment ready 📄", body: "You can now download your file!", link: `/payment/${p.assignment_id}` },
      { user_id: p.writer_id, title: "File released!", body: `Please send ₹${p.writer_payout} payout to the writer via UPI.`, link: `/admin` },
    ]);
    toast.success("🎉 File released to student");
    qc.invalidateQueries({ queryKey: ["admin-payments"] });
    qc.invalidateQueries({ queryKey: ["admin-files"] });
  };

  const cancelPayment = async (p: PaymentRow) => {
    if (!confirm(`Cancel this ₹${p.amount} payment? This cannot be undone.`)) return;
    const { error } = await supabase.from("payments").update({ status: "cancelled" }).eq("id", p.id);
    if (error) return toast.error(error.message);
    await supabase.from("notifications").insert([
      { user_id: p.student_id, title: "Payment cancelled", body: "Your payment has been cancelled by admin.", link: `/payment/${p.assignment_id}` },
    ]);
    toast.success("Payment cancelled");
    qc.invalidateQueries({ queryKey: ["admin-payments"] });
  };

  const viewScreenshot = async (path: string) => {
    const { data } = await supabase.storage.from("assignment-files").createSignedUrl(path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const toggleBan = async (u: ProfileRow) => {
    const action = u.is_banned ? "Unban" : "Ban";
    if (!confirm(`${action} ${u.display_name}?`)) return;
    const { error } = await supabase.from("profiles").update({ is_banned: !u.is_banned }).eq("id", u.id);
    if (error) return toast.error(error.message);
    toast.success(`${u.display_name} ${u.is_banned ? "unbanned" : "banned"}`);
    qc.invalidateQueries({ queryKey: ["admin-profiles"] });
  };

  const sendNotif = async () => {
    if (!notifTitle || !notifBody) return toast.error("Title and body required");
    setSendingNotif(true);
    try {
      const targets = notifTarget.trim()
        ? (profiles ?? []).filter((p) => p.display_name.toLowerCase().includes(notifTarget.toLowerCase()))
        : (profiles ?? []);
      if (!targets.length) return toast.error("No matching users");
      const { error } = await supabase.from("notifications").insert(
        targets.map((p) => ({ user_id: p.id, title: notifTitle, body: notifBody, link: "/feed" }))
      );
      if (error) throw error;
      toast.success(`Sent to ${targets.length} user${targets.length > 1 ? "s" : ""}`);
      setNotifTitle(""); setNotifBody(""); setNotifTarget("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSendingNotif(false);
    }
  };

  const actionableCount = payments?.filter((p) => {
    const f = fileForBid(p.bid_id);
    return (p.status === "awaiting_payment" && p.screenshot_url) ||
           (p.status === "payment_received" && f && !(f as any).released);
  }).length ?? 0;

  return (
    <div className="pb-4">
      {/* Admin hero header */}
      <div className="bg-gradient-hero px-4 pt-10 pb-7 text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-8 w-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium text-primary-foreground/80">Admin HQ</span>
            </div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-xs text-primary-foreground/70 mt-0.5 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-green-300 animate-pulse" />
              Live · refreshes every 15s
            </p>
          </div>
          <button
            onClick={refetchAll}
            className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/25 rounded-xl px-3 py-2 text-xs font-medium hover:bg-white/25 transition active:scale-95"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
        {/* Revenue pill */}
        <div className="mt-4 inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-2.5">
          <IndianRupee className="h-4 w-4" />
          <div>
            <p className="text-[10px] opacity-80">Net profit</p>
            <p className="text-lg font-bold leading-none">₹{stats.profit.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-3 relative z-10">
        {actionableCount > 0 && (
          <div className="mb-3 flex items-center gap-2.5 bg-warning/15 border border-warning/30 rounded-2xl px-4 py-3 text-warning animate-glow-pulse">
            <Zap className="h-4 w-4 shrink-0" />
            <p className="text-sm font-semibold">{actionableCount} payment{actionableCount > 1 ? "s" : ""} need your attention</p>
          </div>
        )}

        <Tabs defaultValue="overview">
          <TabsList className="grid grid-cols-4 w-full rounded-2xl bg-muted/60 p-1">
            <TabsTrigger value="overview" className="rounded-xl text-xs">Overview</TabsTrigger>
            <TabsTrigger value="payments" className="rounded-xl text-xs relative">
              Payments
              {actionableCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-warning text-warning-foreground text-[9px] font-bold flex items-center justify-center">
                  {actionableCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="users" className="rounded-xl text-xs">Users</TabsTrigger>
            <TabsTrigger value="tools" className="rounded-xl text-xs">Tools</TabsTrigger>
          </TabsList>

          {/* ====== OVERVIEW ====== */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            {/* Revenue cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-gradient-primary p-4 text-primary-foreground shadow-glow">
                <IndianRupee className="h-4 w-4 opacity-80 mb-1" />
                <p className="text-xs opacity-80">Revenue</p>
                <p className="text-xl font-bold">₹{stats.revenue.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl bg-gradient-teal p-4 text-white shadow-soft">
                <IndianRupee className="h-4 w-4 opacity-80 mb-1" />
                <p className="text-xs opacity-80">Writer payouts</p>
                <p className="text-xl font-bold">₹{stats.payouts.toLocaleString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Stat icon={Users} label="Users" value={(stats.students + stats.writers).toString()} sub={`+${stats.newUsers7} wk`} tone="primary" />
              <Stat icon={Clock} label="Pending" value={stats.pendingVerify.toString()} tone="warning" />
              <Stat icon={Activity} label="Open" value={stats.openAssignments.toString()} tone="success" />
            </div>

            <ChartCard title="Revenue & profit — 14 days" icon={TrendingUp}>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={series} margin={{ left: -20, right: 5, top: 5 }}>
                  <defs>
                    <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gProf" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--success)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 9 }} stroke="var(--muted-foreground)" />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 11 }} />
                  <Area type="monotone" dataKey="revenue" stroke="var(--primary)" fill="url(#gRev)" strokeWidth={2} />
                  <Area type="monotone" dataKey="profit" stroke="var(--success)" fill="url(#gProf)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="New users — 14 days" icon={Users}>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={series} margin={{ left: -20, right: 5, top: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 9 }} stroke="var(--muted-foreground)" allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 11 }} />
                  <Bar dataKey="users" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {statusPie.length > 0 && (
              <ChartCard title="Payment status" icon={Wallet}>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={statusPie} dataKey="value" nameKey="name" outerRadius={65} innerRadius={38} paddingAngle={3}>
                      {statusPie.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {/* Top writers */}
            {topWriters.length > 0 && (
              <div className="rounded-2xl bg-card border border-border p-4 shadow-card">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="h-4 w-4 text-warning" />
                  <h3 className="font-bold text-sm">Top writers</h3>
                </div>
                <div className="space-y-3">
                  {topWriters.map((w, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${i === 0 ? "bg-gradient-warm text-white shadow-soft" : i === 1 ? "bg-muted" : "bg-muted/60"}`}>
                          {i + 1}
                        </span>
                        <span className="text-sm truncate font-medium">{w.name}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-sm text-success">₹{w.earned}</p>
                        <p className="text-[10px] text-muted-foreground">{w.jobs} jobs</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ====== PAYMENTS ====== */}
          <TabsContent value="payments" className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-sm">All payments ({payments?.length ?? 0})</h2>
              {paymentsLoading && <RefreshCw className="h-3.5 w-3.5 text-muted-foreground animate-spin" />}
            </div>
            <div className="space-y-3">
              {payments?.length === 0 && !paymentsLoading && (
                <div className="text-center py-12 bg-card rounded-2xl border border-border">
                  <div className="text-4xl mb-2">💸</div>
                  <p className="text-sm text-muted-foreground">No payments yet</p>
                </div>
              )}
              {[...(payments ?? [])].sort((a, b) => {
                const score = (p: PaymentRow) => {
                  const f = fileForBid(p.bid_id);
                  if (p.status === "awaiting_payment" && p.screenshot_url) return 0;
                  if (p.status === "payment_received" && f && !(f as any).released) return 1;
                  if (p.status === "payment_received") return 2;
                  if (p.status === "file_delivered") return 4;
                  return 3;
                };
                return score(a) - score(b);
              }).map((p) => {
                const f = fileForBid(p.bid_id);
                const needsVerify = p.status === "awaiting_payment" && p.screenshot_url;
                const needsRelease = p.status === "payment_received" && f && !(f as any).released;
                return (
                  <div key={p.id} className={`rounded-2xl bg-card border p-4 shadow-card transition-all ${needsVerify ? "border-warning/50 ring-2 ring-warning/20" : needsRelease ? "border-primary/50 ring-2 ring-primary/20" : "border-border"}`}>
                    {needsVerify && (
                      <div className="mb-3 px-3 py-2 rounded-xl bg-warning/10 text-warning text-xs font-semibold flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 shrink-0" />Screenshot uploaded — verify payment now
                      </div>
                    )}
                    {needsRelease && (
                      <div className="mb-3 px-3 py-2 rounded-xl bg-primary/10 text-primary text-xs font-semibold flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 shrink-0" />File uploaded — release to student
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate">{p.assignment?.title}</p>
                        <p className="text-xs text-muted-foreground">{p.assignment?.subject}</p>
                      </div>
                      <StatusBadge status={p.status} />
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <MiniStat label="Total" value={p.amount} />
                      <MiniStat label="Profit (15%)" value={p.commission} tone="success" />
                      <MiniStat label="Writer" value={p.writer_payout} />
                    </div>

                    <div className="text-xs space-y-1 mb-3 bg-muted/40 rounded-xl px-3 py-2">
                      <p><span className="text-muted-foreground">Student:</span> <span className="font-medium">{p.student?.display_name}</span></p>
                      <p>
                        <span className="text-muted-foreground">Writer:</span> <span className="font-medium">{p.writer?.display_name}</span>
                        {p.writer?.upi_id && <span className="font-mono text-primary ml-1">· {p.writer.upi_id}</span>}
                      </p>
                      <p className="text-muted-foreground">{new Date(p.created_at).toLocaleString()}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {p.screenshot_url && (
                        <Button size="sm" variant="outline" onClick={() => viewScreenshot(p.screenshot_url!)} className="rounded-xl text-xs h-8">
                          <Eye className="h-3.5 w-3.5 mr-1" />Screenshot
                        </Button>
                      )}
                      {needsVerify && (
                        <Button size="sm" onClick={() => markReceived(p)} className="rounded-xl text-xs h-8 bg-success hover:bg-success/90 text-success-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Confirm payment
                        </Button>
                      )}
                      {f && (
                        <Button size="sm" variant="outline" onClick={() => viewScreenshot((f as any).storage_path)} className="rounded-xl text-xs h-8">
                          <FileText className="h-3.5 w-3.5 mr-1" />View file
                        </Button>
                      )}
                      {needsRelease && (
                        <Button size="sm" onClick={() => releaseFile(p)} className="rounded-xl text-xs h-8 bg-gradient-primary">
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Release file
                        </Button>
                      )}
                      {f && (f as any).released && (
                        <span className="text-[11px] text-success flex items-center gap-1 font-medium">
                          <CheckCircle2 className="h-3 w-3" />Delivered
                        </span>
                      )}
                      {p.status !== "cancelled" && p.status !== "file_delivered" && (
                        <Button size="sm" variant="ghost" onClick={() => cancelPayment(p)} className="rounded-xl text-xs h-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                          <XCircle className="h-3.5 w-3.5 mr-1" />Cancel
                        </Button>
                      )}
                      <Link to="/assignment/$id" params={{ id: p.assignment_id }}>
                        <Button size="sm" variant="ghost" className="rounded-xl h-8 w-8 p-0">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* ====== USERS ====== */}
          <TabsContent value="users" className="mt-4">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-2xl bg-gradient-primary p-3 text-primary-foreground shadow-soft">
                <GraduationCap className="h-4 w-4 mb-1 opacity-80" />
                <p className="text-xs opacity-80">Students</p>
                <p className="text-2xl font-bold">{stats.students}</p>
              </div>
              <div className="rounded-2xl bg-gradient-teal p-3 text-white shadow-soft">
                <PenLine className="h-4 w-4 mb-1 opacity-80" />
                <p className="text-xs opacity-80">Writers</p>
                <p className="text-2xl font-bold">{stats.writers}</p>
              </div>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search name, role, UPI…" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="pl-10 rounded-2xl" />
            </div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">{filteredProfiles.length} users</p>
            <div className="space-y-2">
              {filteredProfiles.map((u) => (
                <div key={u.id} className={`rounded-2xl bg-card border p-3.5 flex items-center justify-between shadow-card ${u.is_banned ? "border-destructive/30 bg-destructive/5" : "border-border"}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">{u.display_name}</p>
                      {u.is_banned && <span className="text-[10px] bg-destructive/15 text-destructive px-1.5 py-0.5 rounded-full font-bold">Banned</span>}
                    </div>
                    <p className="text-[11px] text-muted-foreground capitalize">{u.role} · ★{Number(u.rating).toFixed(1)} · {u.jobs_completed} jobs</p>
                    {u.upi_id && <p className="text-[10px] font-mono text-primary truncate mt-0.5">{u.upi_id}</p>}
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</span>
                    <Button size="sm" variant="ghost" onClick={() => toggleBan(u)}
                      className={`h-8 w-8 p-0 rounded-xl ${u.is_banned ? "text-success hover:text-success hover:bg-success/10" : "text-destructive hover:text-destructive hover:bg-destructive/10"}`}>
                      {u.is_banned ? <RotateCcw className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ====== TOOLS ====== */}
          <TabsContent value="tools" className="mt-4 space-y-4">
            <div className="rounded-2xl bg-card border border-border p-4 shadow-card space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-gradient-primary flex items-center justify-center shadow-soft">
                  <Bell className="h-4 w-4 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Send notification</h3>
                  <p className="text-xs text-muted-foreground">Leave target empty to broadcast to all</p>
                </div>
              </div>
              <Input placeholder="Target user (blank = all)" value={notifTarget} onChange={(e) => setNotifTarget(e.target.value)} className="rounded-xl" />
              <Input placeholder="Title" value={notifTitle} onChange={(e) => setNotifTitle(e.target.value)} className="rounded-xl" />
              <Input placeholder="Message body" value={notifBody} onChange={(e) => setNotifBody(e.target.value)} className="rounded-xl" />
              <Button className="w-full bg-gradient-primary rounded-xl" disabled={sendingNotif || !notifTitle || !notifBody} onClick={sendNotif}>
                {sendingNotif ? "Sending…" : `Send to ${notifTarget.trim() ? "matched users" : "all users"}`}
              </Button>
            </div>

            {/* Platform stats */}
            <div className="rounded-2xl bg-gradient-soft border border-border p-4 shadow-card space-y-2.5">
              <h3 className="font-bold text-sm mb-1">Platform stats</h3>
              {[
                ["Net profit", `₹${stats.profit.toLocaleString()}`],
                ["Total revenue", `₹${stats.revenue.toLocaleString()}`],
                ["Writer payouts", `₹${stats.payouts.toLocaleString()}`],
                ["Total users", (stats.students + stats.writers).toString()],
                ["Open assignments", stats.openAssignments.toString()],
                ["Last refresh", lastRefresh.toLocaleTimeString()],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-semibold">{v}</span>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string; tone: string }) {
  const colors: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    muted: "bg-muted text-foreground",
    warning: "bg-warning/10 text-warning",
  };
  return (
    <div className="rounded-2xl bg-card border border-border p-3 shadow-card">
      <div className={`inline-flex items-center justify-center h-7 w-7 rounded-xl ${colors[tone]}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <p className="text-xs text-muted-foreground mt-2">{label}</p>
      <p className="text-lg font-bold">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className={`rounded-xl p-2 ${tone === "success" ? "bg-success/10" : "bg-muted/50"}`}>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`font-bold text-sm flex items-center gap-0.5 ${tone === "success" ? "text-success" : ""}`}>
        <IndianRupee className="h-3 w-3" />{value}
      </p>
    </div>
  );
}

function ChartCard({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-3 shadow-card">
      <div className="flex items-center gap-2 mb-2 px-1">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    awaiting_payment: { label: "Awaiting", cls: "bg-warning/15 text-warning border border-warning/30" },
    payment_received: { label: "Paid ✓", cls: "bg-primary/15 text-primary border border-primary/30" },
    file_delivered: { label: "Delivered ✓", cls: "bg-success/15 text-success border border-success/30" },
    cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground" },
  };
  const x = map[status] ?? map.awaiting_payment;
  return <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${x.cls}`}>{x.label}</span>;
}
