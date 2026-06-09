import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AssignmentCard } from "@/components/AssignmentCard";
import { Input } from "@/components/ui/input";
import { Search, Sparkles, Plus, TrendingUp, BookOpen } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const SUBJECTS = [
  { label: "All", emoji: "✨" },
  { label: "Math", emoji: "📐" },
  { label: "Science", emoji: "🔬" },
  { label: "English", emoji: "📝" },
  { label: "History", emoji: "📜" },
  { label: "Coding", emoji: "💻" },
  { label: "Art", emoji: "🎨" },
];

export const Route = createFileRoute("/_app/feed")({
  component: FeedPage,
});

function SkeletonCard() {
  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="h-1 w-full shimmer" />
      <div className="p-4 space-y-3">
        <div className="h-5 w-20 rounded-full shimmer" />
        <div className="h-4 w-full rounded shimmer" />
        <div className="h-4 w-3/4 rounded shimmer" />
        <div className="flex justify-between mt-2">
          <div className="h-4 w-16 rounded shimmer" />
          <div className="h-4 w-24 rounded shimmer" />
        </div>
      </div>
    </div>
  );
}

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
    refetchInterval: 30_000, // auto-refresh every 30s
  });

  const filtered = (assignments ?? []).filter((a) => {
    if (subject !== "All" && a.subject !== subject) return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const firstName = profile?.display_name?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="pb-4">
      {/* Hero header */}
      <div className="bg-gradient-hero px-4 pt-10 pb-7 text-primary-foreground relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/3 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-black/10 translate-y-1/2 -translate-x-1/4 blur-2xl pointer-events-none" />

        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-sm text-primary-foreground/80 font-medium">{greeting}, {firstName} 👋</p>
            <h1 className="text-3xl font-bold mt-0.5 flex items-center gap-2">
              <Sparkles className="h-7 w-7" />
              AssiMate
            </h1>
            <p className="text-sm text-primary-foreground/70 mt-1">
              {assignments?.length ?? 0} open assignments
            </p>
          </div>
          <Link
            to="/post"
            className="rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 text-white p-3 shadow-soft hover:bg-white/30 transition-all active:scale-95"
            aria-label="Post assignment"
          >
            <Plus className="h-5 w-5" />
          </Link>
        </div>

        {/* Stats pills */}
        <div className="flex gap-2 mt-4">
          <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs font-medium">
            <TrendingUp className="h-3 w-3" />
            Live bids
          </div>
          <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs font-medium">
            <BookOpen className="h-3 w-3" />
            All subjects
          </div>
        </div>
      </div>

      <div className="px-4 -mt-3 relative z-10">
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assignments…"
            className="pl-10 h-12 rounded-2xl bg-card border-border shadow-card text-sm"
          />
        </div>

        {/* Subject chips */}
        <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-none mb-2">
          {SUBJECTS.map(({ label, emoji }) => (
            <button
              key={label}
              onClick={() => setSubject(label)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                subject === label
                  ? "bg-gradient-primary text-primary-foreground shadow-soft scale-105"
                  : "bg-card text-muted-foreground border border-border hover:border-primary/40 hover:text-primary"
              }`}
            >
              <span>{emoji}</span>
              {label}
            </button>
          ))}
        </div>

        {/* Cards */}
        <div className="space-y-3 mt-1">
          {isLoading && Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}

          {!isLoading && filtered.length === 0 && (
            <div className="text-center py-16 px-4">
              <div className="text-6xl mb-4 animate-float">📚</div>
              <p className="font-bold text-lg">No assignments found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {search ? "Try a different search term" : "Be the first to post one!"}
              </p>
              <Link
                to="/post"
                className="inline-flex items-center gap-2 mt-4 bg-gradient-primary text-primary-foreground px-5 py-2.5 rounded-2xl font-medium text-sm shadow-soft"
              >
                <Plus className="h-4 w-4" /> Post assignment
              </Link>
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
    </div>
  );
}
