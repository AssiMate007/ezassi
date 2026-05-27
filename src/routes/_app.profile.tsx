import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star, LogOut, GraduationCap, PenLine, Sparkles, Trash2 } from "lucide-react";
import { AssignmentCard } from "@/components/AssignmentCard";
import { seedDemo, clearDemo } from "@/lib/demo.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const qc = useQueryClient();
  const seedFn = useServerFn(seedDemo);
  const clearFn = useServerFn(clearDemo);
  const [busy, setBusy] = useState<"seed" | "clear" | null>(null);

  const handleSeed = async () => {
    setBusy("seed");
    try {
      await seedFn();
      toast.success("Demo data added! Check the feed 🎯");
      qc.invalidateQueries();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };
  const handleClear = async () => {
    setBusy("clear");
    try {
      const res = await clearFn();
      toast.success(`Removed ${res.removed} demo user(s) and their data`);
      qc.invalidateQueries();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
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

        <div className="mt-6 space-y-2 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4">
          <p className="text-sm font-semibold flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-primary" /> Demo data</p>
          <p className="text-xs text-muted-foreground">Add a sample student, writer, assignment, bids & chat to see the app in action.</p>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleSeed} disabled={busy !== null} className="flex-1 bg-gradient-primary">
              <Sparkles className="h-4 w-4 mr-1" />{busy === "seed" ? "Adding…" : "Seed demo"}
            </Button>
            <Button size="sm" variant="outline" onClick={handleClear} disabled={busy !== null} className="flex-1">
              <Trash2 className="h-4 w-4 mr-1" />{busy === "clear" ? "Removing…" : "Clear demo"}
            </Button>
          </div>
        </div>

        <Button variant="outline" onClick={signOut} className="w-full mt-4">
          <LogOut className="h-4 w-4 mr-2" />Sign out
        </Button>
      </div>
    </div>
  );
}
