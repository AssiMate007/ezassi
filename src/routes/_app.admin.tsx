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
  Sparkles, Search, Ban, RotateCcw, Bell, XCircle,
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
    queryFn: async () => (await supabase.from("assignment_files").select("*")).data ?? [],
  });

  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      return (data ?? []) as unknown as ProfileRow[];
    },
  });

  const { data: assignments } = useQuery({
    queryKey: ["admin-assignments"],
    enabled: isAdmin,
    queryFn: async () => (await supabase.from("assignments").select("id,status,created_at,budget_min,budget_max")).data ?? [],
  });

  const { data: bids } = useQuery({
    queryKey: ["admin-bids"],
    enabled: isAdmin,
    queryFn: async () => (await supabase.from("bids").select("id,created_at,amount,status")).data ?? [],
  });

  // Realtime subscriptions
  useEffect(() => {
    if (!isAdmin) return;
    const ch = supabase
      .channel("admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => qc.invalidateQueries({ queryKey: ["admin-payments"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "assignment_files" }, () => qc.invalidateQueries({ queryKey: ["admin-files"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => qc.invalidateQueries({ queryKey: ["admin-profiles"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "assignments" }, () => qc.invalidateQueries({ queryKey: ["admin-assignments"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "bids" }, () => qc.invalidateQueries({ queryKey: ["admin-bids"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin, qc]);

  // Derived stats
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

  // 14-day series
  const series = useMemo(() => {
    const days: { date: string; label: string; users: number; revenue: number; profit: number; bids: number }[] = [];
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
      days.push({ date: d.toISOString().slice(0, 10), label, users: usersN, revenue: rev, profit: prof, bids: bidsN });
    }
    return days;
  }, [profiles, payments, bids]);

  const statusPie = useMemo(() => {
    const buckets: Record<string, number> = { awaiting_payment: 0, payment_received: 0, file_delivered: 0, cancelled: 0 };
    payments?.forEach((p) => { buckets[p.status] = (buckets[p.status] ?? 0) + 1; });
    return [
      { name: "Awaiting", value: buckets.awaiting_payment },
      { name: "Paid", value: buckets.payment_received },
      { name: "Delivered", value: buckets.file_delivered },
      { name: "Cancelled", value: buckets.cancelled },
    ].filter((x) => x.value > 0);
  }, [payments]);

  const topWriters = useMemo(() => {
    const map = new Map<string, { name: string; jobs: number; earned: number }>();
    payments?.filter((p) => p.status === "file_delivered").forEach((p) => {
      const k = p.writer_id;
      const prev = map.get(k) ?? { name: p.writer?.display_name ?? "Writer", jobs: 0, earned: 0 };
      prev.jobs += 1; prev.earned += p.writer_payout;
      map.set(k, prev);
    });
    return [...map.values()].sort((a, b) => b.earned - a.earned).slice(0, 5);
  }, [payments]);

  const filteredProfiles = useMemo(() => {
    if (!userSearch.trim()) return profiles ?? [];
    const q = userSearch.toLowerCase();
    return (profiles ?? []).filter((p) =>
      p.display_name.toLowerCase().includes(q) ||
      p.role.includes(q) ||
      (p.upi_id ?? "").toLowerCase().includes(q)
    );
  }, [profiles, userSearch]);

  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <ShieldAlert className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">Admin access only.</p>
        <Link to="/admin-auth" className="text-primary text-sm underline mt-2 inline-block">Go to admin login</Link>
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

  const cancelPayment = async (p: PaymentRow) => {
    if (!confirm(`Cancel this payment of ₹${p.amount}? This cannot be undone.`)) return;
    const { error } = await supabase.from("payments").update({ status: "cancelled" }).eq("id", p.id);
    if (error) return toast.error(error.message);
    await supabase.from("notifications").insert([
      { user_id: p.student_id, title: "Payment cancelled", body: "Your payment has been cancelled by admin.", link: `/payment/${p.assignment_id}` },
    ]);
    toast.success("Payment cancelled");
    qc.invalidateQueries({ queryKey: ["admin-payments"] });
  };

  const toggleBan = async (u: ProfileRow) => {
    const action = u.is_banned ? "unban" : "ban";
    if (!confirm(`${action === "ban" ? "Ban" : "Unban"} ${u.display_name}?`)) return;
    const { error } = await supabase.from("profiles").update({ is_banned: !u.is_banned }).eq("id", u.id);
    if (error) return toast.error(error.message);
    toast.success(`${u.display_name} ${action === "ban" ? "banned" : "unbanned"}`);
    qc.invalidateQueries({ queryKey: ["admin-profiles"] });
  };

  const sendBroadcastNotif = async () => {
    if (!notifTitle || !notifBody) return toast.error("Title and body required");
    setSendingNotif(true);
    try {
      const targets = notifTarget.trim()
        ? (profiles ?? []).filter((p) => p.display_name.toLowerCase().includes(notifTarget.toLowerCase()))
        : (profiles ?? []);
      if (targets.length === 0) return toast.error("No matching users found");
      const rows = targets.map((p) => ({
        user_id: p.id,
        title: notifTitle,
        body: notifBody,
        link: "/feed",
      }));
      const { error } = await supabase.from("notifications").insert(rows);
      if (error) throw error;
      toast.success(`Notification sent to ${targets.length} user${targets.length > 1 ? "s" : ""}`);
      setNotifTitle(""); setNotifBody(""); setNotifTarget("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSendingNotif(false);
    }
  };

  return (
    <div className="px-4 pt-6 pb-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="h-9 w-9 rounded-full bg-gradient-primary flex items-center justify-center shadow-soft">
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold leading-tight">Admin HQ</h1>
          <p className="text-xs text-muted-foreground">Owner dashboard · live</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="mt-4">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="payments">
            Payments
            {stats.pendingVerify > 0 && (
              <span className="ml-1 h-4 w-4 rounded-full bg-warning text-warning-foreground text-[10px] font-bold flex items-center justify-center">
                {stats.pendingVerify}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
        </TabsList>

        {/* ============ OVERVIEW ============ */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="rounded-3xl bg-gradient-primary p-5 text-primary-foreground shadow-glow relative overflow-hidden">
            <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
            <p className="text-xs opacity-80">Your net profit (15%)</p>
            <p className="text-4xl font-bold flex items-center mt-1"><IndianRupee className="h-7 w-7" />{stats.profit.toLocaleString()}</p>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-white/15 backdrop-blur rounded-xl p-2">
                <p className="text-[10px] opacity-80">Revenue moved</p>
                <p className="font-semibold flex items-center"><IndianRupee className="h-3.5 w-3.5" />{stats.revenue.toLocaleString()}</p>
              </div>
              <div className="bg-white/15 backdrop-blur rounded-xl p-2">
                <p className="text-[10px] opacity-80">Writer payouts</p>
                <p className="font-semibold flex items-center"><IndianRupee className="h-3.5 w-3.5" />{stats.payouts.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Stat icon={Users} label="Total users" value={(stats.students + stats.writers).toString()} sub={`+${stats.newUsers7} this week`} tone="primary" />
            <Stat icon={Clock} label="Pending verify" value={stats.pendingVerify.toString()} sub="action needed" tone="warning" />
            <Stat icon={GraduationCap} label="Students" value={stats.students.toString()} tone="muted" />
            <Stat icon={PenLine} label="Writers" value={stats.writers.toString()} tone="muted" />
            <Stat icon={Activity} label="Open jobs" value={stats.openAssignments.toString()} tone="success" />
            <Stat icon={FileText} label="Total bids" value={(bids?.length ?? 0).toString()} tone="muted" />
          </div>

          <ChartCard title="Revenue & profit (14d)" icon={TrendingUp}>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={series} margin={{ left: -20, right: 5, top: 5 }}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gProf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--success)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="var(--primary)" fill="url(#gRev)" strokeWidth={2} />
                <Area type="monotone" dataKey="profit" stroke="var(--success)" fill="url(#gProf)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="New users (14d)" icon={Users}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={series} margin={{ left: -20, right: 5, top: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="users" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Bid activity (14d)" icon={Activity}>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={series} margin={{ left: -20, right: 5, top: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="bids" stroke="var(--primary)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {statusPie.length > 0 && (
            <ChartCard title="Payment status mix" icon={Wallet}>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={statusPie} dataKey="value" nameKey="name" outerRadius={70} innerRadius={40} paddingAngle={3}>
                    {statusPie.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          <div className="rounded-2xl bg-card border border-border p-4 shadow-card">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-4 w-4 text-warning" />
              <h3 className="font-bold text-sm">Top writers</h3>
            </div>
            {topWriters.length === 0 && <p className="text-xs text-muted-foreground">No completed jobs yet</p>}
            <div className="space-y-2">
              {topWriters.map((w, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? "bg-warning text-warning-foreground" : "bg-muted"}`}>{i + 1}</span>
                    <span className="truncate">{w.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold flex items-center justify-end"><IndianRupee className="h-3 w-3" />{w.earned}</p>
                    <p className="text-[10px] text-muted-foreground">{w.jobs} jobs</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ============ PAYMENTS ============ */}
        <TabsContent value="payments" className="mt-4">
          <h2 className="font-bold mb-2 text-sm">All payments</h2>
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          <div className="space-y-3">
            {payments?.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No payments yet</p>}
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
                <div key={p.id} className={`rounded-2xl bg-card border p-4 shadow-card ${needsVerify ? "border-warning ring-2 ring-warning/30" : needsRelease ? "border-primary ring-2 ring-primary/30" : "border-border"}`}>
                  {needsVerify && (
                    <div className="mb-3 -mx-1 px-3 py-1.5 rounded-lg bg-warning/15 text-warning text-xs font-semibold flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> Screenshot uploaded — verify payment
                    </div>
                  )}
                  {needsRelease && (
                    <div className="mb-3 -mx-1 px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-semibold flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" /> Writer uploaded file — release to student
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{p.assignment?.title}</p>
                      <p className="text-xs text-muted-foreground">{p.assignment?.subject}</p>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>

                  <div className="grid grid-cols-3 gap-2 my-3 text-xs">
                    <Mini label="Total" value={p.amount} />
                    <Mini label="Profit" value={p.commission} tone="success" />
                    <Mini label="Writer" value={p.writer_payout} />
                  </div>

                  <div className="text-xs space-y-1 mb-3">
                    <p><span className="text-muted-foreground">Student:</span> {p.student?.display_name}</p>
                    <p><span className="text-muted-foreground">Writer:</span> {p.writer?.display_name} {p.writer?.upi_id && <span className="font-mono text-primary">· {p.writer.upi_id}</span>}</p>
                    <p className="text-muted-foreground">{new Date(p.created_at).toLocaleString()}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {p.screenshot_url && (
                      <Button size="sm" variant="outline" onClick={() => viewScreenshot(p.screenshot_url!)}>
                        <Eye className="h-3.5 w-3.5 mr-1" />Screenshot
                      </Button>
                    )}
                    {p.status === "awaiting_payment" && p.screenshot_url && (
                      <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground" onClick={() => markReceived(p)}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Confirm payment
                      </Button>
                    )}
                    {f && (
                      <Button size="sm" variant="outline" onClick={() => viewScreenshot((f as any).storage_path)}>
                        <FileText className="h-3.5 w-3.5 mr-1" />View file
                      </Button>
                    )}
                    {needsRelease && (
                      <Button size="sm" className="bg-gradient-primary" onClick={() => releaseFile(p)}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Release to student
                      </Button>
                    )}
                    {f && (f as any).released && (
                      <span className="text-[11px] text-success flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />Delivered
                      </span>
                    )}
                    {p.status !== "cancelled" && p.status !== "file_delivered" && (
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => cancelPayment(p)}>
                        <XCircle className="h-3.5 w-3.5 mr-1" />Cancel
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
        </TabsContent>

        {/* ============ USERS ============ */}
        <TabsContent value="users" className="mt-4">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Stat icon={GraduationCap} label="Students" value={stats.students.toString()} tone="primary" />
            <Stat icon={PenLine} label="Writers" value={stats.writers.toString()} tone="success" />
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, role, UPI…"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <h2 className="font-bold mb-2 text-sm">All users · {filteredProfiles.length}</h2>
          <div className="space-y-2">
            {filteredProfiles.map((u) => (
              <div key={u.id} className={`rounded-xl bg-card border p-3 flex items-center justify-between shadow-card ${u.is_banned ? "border-destructive/40 bg-destructive/5" : "border-border"}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate">{u.display_name}</p>
                    {u.is_banned && <span className="text-[10px] bg-destructive/15 text-destructive px-1.5 py-0.5 rounded-full font-semibold">Banned</span>}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {u.role} · ★ {Number(u.rating).toFixed(1)} · {u.jobs_completed} jobs
                  </p>
                  {u.upi_id && <p className="text-[10px] font-mono text-primary truncate">{u.upi_id}</p>}
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {new Date(u.created_at).toLocaleDateString()}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className={u.is_banned ? "text-success hover:text-success" : "text-destructive hover:text-destructive"}
                    onClick={() => toggleBan(u)}
                    aria-label={u.is_banned ? "Unban user" : "Ban user"}
                  >
                    {u.is_banned ? <RotateCcw className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            ))}
            {filteredProfiles.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">No users found</p>
            )}
          </div>
        </TabsContent>

        {/* ============ TOOLS ============ */}
        <TabsContent value="tools" className="mt-4 space-y-4">
          {/* Broadcast notification */}
          <div className="rounded-2xl bg-card border border-border p-4 shadow-card space-y-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <h3 className="font-bold text-sm">Send notification</h3>
            </div>
            <p className="text-xs text-muted-foreground">Leave "Target user" empty to broadcast to all users.</p>
            <div className="space-y-2">
              <Input
                placeholder="Target user name (optional — blank = all)"
                value={notifTarget}
                onChange={(e) => setNotifTarget(e.target.value)}
              />
              <Input
                placeholder="Notification title"
                value={notifTitle}
                onChange={(e) => setNotifTitle(e.target.value)}
              />
              <Input
                placeholder="Message body"
                value={notifBody}
                onChange={(e) => setNotifBody(e.target.value)}
              />
              <Button
                className="w-full bg-gradient-primary"
                disabled={sendingNotif || !notifTitle || !notifBody}
                onClick={sendBroadcastNotif}
              >
                {sendingNotif ? "Sending…" : `Send to ${notifTarget.trim() ? "matched users" : "all users"}`}
              </Button>
            </div>
          </div>

          {/* Quick links */}
          <div className="rounded-2xl bg-card border border-border p-4 shadow-card">
            <h3 className="font-bold text-sm mb-3">Quick links</h3>
            <div className="space-y-2">
              {[
                { label: "View live feed", href: "/feed" },
                { label: "Supabase dashboard", href: "https://supabase.com/dashboard" },
                { label: "Terms of Service", href: "/terms" },
                { label: "Refund Policy", href: "/refund" },
              ].map(({ label, href }) => (
                <a key={href} href={href} target={href.startsWith("http") ? "_blank" : "_self"} rel="noreferrer"
                  className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-muted transition">
                  <span>{label}</span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
              ))}
            </div>
          </div>

          {/* Platform info */}
          <div className="rounded-2xl bg-muted/50 border border-border p-4 text-xs text-muted-foreground space-y-1">
            <p><span className="font-semibold text-foreground">Platform:</span> AssiMate v1.0</p>
            <p><span className="font-semibold text-foreground">Admin email:</span> assimate007@gmail.com</p>
            <p><span className="font-semibold text-foreground">Commission:</span> 15% per transaction</p>
            <p><span className="font-semibold text-foreground">Total users:</span> {(stats.students + stats.writers).toLocaleString()}</p>
            <p><span className="font-semibold text-foreground">Total revenue:</span> ₹{stats.revenue.toLocaleString()}</p>
          </div>
        </TabsContent>
      </Tabs>
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
      <div className={`inline-flex items-center justify-center h-7 w-7 rounded-full ${colors[tone]}`}><Icon className="h-3.5 w-3.5" /></div>
      <p className="text-xs text-muted-foreground mt-2">{label}</p>
      <p className="text-lg font-bold">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: number; tone?: string }) {
  const bg = tone === "success" ? "bg-success/10" : "bg-muted/50";
  const fg = tone === "success" ? "text-success" : "";
  return (
    <div className={`${bg} rounded-lg p-2`}>
      <p className="text-muted-foreground">{label}</p>
      <p className={`font-bold flex items-center ${fg}`}><IndianRupee className="h-3 w-3" />{value}</p>
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
    awaiting_payment: { label: "Awaiting", cls: "bg-warning/15 text-warning" },
    payment_received: { label: "Paid", cls: "bg-primary/15 text-primary" },
    file_delivered: { label: "Delivered", cls: "bg-success/15 text-success" },
    cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground" },
  };
  const x = map[status] ?? map.awaiting_payment;
  return <span className={`text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${x.cls}`}>{x.label}</span>;
}
