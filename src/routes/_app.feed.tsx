import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AssignmentCard } from "@/components/AssignmentCard";
import { Input } from "@/components/ui/input";
import { Search, Sparkles, Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const SUBJECTS = ["All", "Math", "Science", "English", "History", "Coding", "Art"];

export const Route = createFileRoute("/_app/feed")({
  component: FeedPage,
});

function FeedPage() {
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("All");

  const { data: assignments, isLoading } = useQuery({
    queryKey: ["assignments", "open"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("*, student:profiles!assignments_student_id_fkey(display_name, avatar_url), bids(count)")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = (assignments ?? []).filter((a) => {
    if (subject !== "All" && a.subject !== subject) return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="px-4 pt-6 pb-4">
      <header className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm text-muted-foreground">Hey {profile?.display_name?.split(" ")[0] ?? "there"} 👋</p>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-gradient">AssiMate</span>
          </h1>
        </div>
        <Link
          to="/post"
          className="rounded-full bg-gradient-primary text-primary-foreground p-3 shadow-soft hover:shadow-glow transition"
          aria-label="Post assignment"
        >
          <Plus className="h-5 w-5" />
        </Link>
      </header>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search assignments…"
          className="pl-9 bg-card border-border h-11 rounded-xl"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-none">
        {SUBJECTS.map((s) => (
          <button
            key={s}
            onClick={() => setSubject(s)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition ${
              subject === s
                ? "bg-gradient-primary text-primary-foreground shadow-soft"
                : "bg-card text-muted-foreground border border-border"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="space-y-3 mt-4">
        {isLoading && <div className="text-center text-muted-foreground py-8">Loading…</div>}
        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-16 px-4">
            <div className="text-5xl mb-3">📚</div>
            <p className="font-semibold">No assignments yet</p>
            <p className="text-sm text-muted-foreground mt-1">Be the first to post one!</p>
          </div>
        )}
        {filtered.map((a) => (
          <AssignmentCard
            key={a.id}
            a={{
              id: a.id,
              title: a.title,
              subject: a.subject,
              budget_min: a.budget_min,
              budget_max: a.budget_max,
              deadline: a.deadline,
              bid_count: a.bids?.[0]?.count ?? 0,
              student: a.student as { display_name: string; avatar_url: string | null } | null,
            }}
          />
        ))}
      </div>
    </div>
  );
}
