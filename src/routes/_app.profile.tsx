import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star, LogOut, GraduationCap, PenLine, Wallet, CheckCircle2 } from "lucide-react";
import { AssignmentCard } from "@/components/AssignmentCard";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [upiId, setUpiId] = useState("");
  const [savingUpi, setSavingUpi] = useState(false);

  useEffect(() => {
    if (profile && "upi_id" in profile) setUpiId((profile as { upi_id?: string | null }).upi_id ?? "");
  }, [profile]);

  const saveUpi = async () => {
    if (!user) return;
    const trimmed = upiId.trim();
    if (trimmed && !/^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/.test(trimmed)) {
      return toast.error("Enter a valid UPI ID (e.g. name@okhdfcbank)");
    }
    setSavingUpi(true);
    const { error } = await supabase.from("profiles").update({ upi_id: trimmed || null } as never).eq("id", user.id);
    setSavingUpi(false);
    if (error) return toast.error(error.message);
    toast.success("UPI ID saved ✓");
  };



  const { data: myAssignments } = useQuery({
    queryKey: ["my-assignments", user?.id, profile?.role],
    queryFn: async () => {
      if (!user || !profile) return [];
      if (profile.role === "student") {
        const { data } = await supabase.from("assignments").select("*, bids(count)").eq("student_id", user.id).order("created_at", { ascending: false });
        return data ?? [];
      } else {
        const { data } = await supabase.from("bids").select("*, assignment:assignments(*)").eq("writer_id", user.id).order("created_at", { ascending: false });
        return (data ?? []).map((b) => b.assignment).filter(Boolean);
      }
    },
    enabled: !!profile,
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  if (!profile) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <div>
      <div className="bg-gradient-hero pt-10 pb-16 px-4 text-primary-foreground text-center rounded-b-3xl">
        <Avatar className="h-20 w-20 mx-auto ring-4 ring-white/30">
          <AvatarFallback className="text-2xl bg-white/20 text-primary-foreground">
            {profile.display_name.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <h1 className="mt-3 text-xl font-bold">{profile.display_name}</h1>
        <div className="mt-1 flex items-center justify-center gap-1.5 text-sm text-primary-foreground/90">
          {profile.role === "student" ? <GraduationCap className="h-4 w-4" /> : <PenLine className="h-4 w-4" />}
          <span className="capitalize">{profile.role}</span>
        </div>
        <div className="mt-4 flex justify-center gap-6">
          <div>
            <div className="flex items-center justify-center gap-1 text-lg font-bold">
              <Star className="h-4 w-4 fill-warning text-warning" />
              {Number(profile.rating).toFixed(1)}
            </div>
            <p className="text-xs text-primary-foreground/80">Rating</p>
          </div>
          <div className="w-px bg-white/30" />
          <div>
            <div className="text-lg font-bold">{profile.jobs_completed}</div>
            <p className="text-xs text-primary-foreground/80">{profile.role === "student" ? "Assignments" : "Jobs done"}</p>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-8">
        <div className="bg-card rounded-2xl p-4 shadow-card border border-border mb-4">
          {profile.bio ? (
            <p className="text-sm text-muted-foreground">{profile.bio}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">No bio yet</p>
          )}
        </div>

        <div className="bg-card rounded-2xl p-4 shadow-card border border-border mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">UPI ID for payouts</h3>
            {profile && (profile as { upi_id?: string | null }).upi_id && (
              <CheckCircle2 className="h-4 w-4 text-success ml-auto" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            {profile.role === "writer"
              ? "Required to receive your 85% payout once an assignment is released."
              : "Optional — used only if a refund needs to be sent to you."}
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="yourname@okhdfcbank"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              maxLength={100}
              autoCapitalize="none"
              autoCorrect="off"
            />
            <Button onClick={saveUpi} disabled={savingUpi} className="bg-gradient-primary">
              {savingUpi ? "…" : "Save"}
            </Button>
          </div>
        </div>

        <h2 className="font-bold mb-3">{profile.role === "student" ? "My assignments" : "My bids"}</h2>
        <div className="space-y-3">
          {!myAssignments?.length && (
            <p className="text-sm text-muted-foreground text-center py-6">Nothing here yet</p>
          )}
          {myAssignments?.map((a) => a && (
            <AssignmentCard key={a.id} a={{
              id: a.id, title: a.title, subject: a.subject,
              budget_min: a.budget_min, budget_max: a.budget_max, deadline: a.deadline,
              bid_count: (a as { bids?: { count: number }[] }).bids?.[0]?.count,
            }} />
          ))}
        </div>


        <Button variant="outline" onClick={signOut} className="w-full mt-4">
          <LogOut className="h-4 w-4 mr-2" />Sign out
        </Button>

        <div className="mt-6 pt-5 border-t border-border flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <a href="/about" className="hover:text-foreground">About</a>
          <a href="/terms" className="hover:text-foreground">Terms</a>
          <a href="/privacy" className="hover:text-foreground">Privacy</a>
          <a href="/refund" className="hover:text-foreground">Refunds</a>
          <a href="/contact" className="hover:text-foreground">Contact</a>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">© {new Date().getFullYear()} AssiMate</p>
      </div>
    </div>
  );
}
