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
    <div className="rounded-2xl border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-5 w-20 rounded-md bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          <div className="h-4 w-12 rounded-md bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-5 w-full rounded-md bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          <div className="h-4 w-3/4 rounded-md bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
        </div>
        <div className="pt-2 flex justify-between items-center border-t border-zinc-50 dark:border-zinc-800/60">
          <div className="h-4 w-24 rounded-md bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          <div className="h-4 w-16 rounded-md bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
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
    refetchInterval: 30_000,
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
    <div className="min-h-screen bg-zinc-50/50 pb-12 dark:bg-zinc-950">
      {/* Premium Structural Header Layout */}
      <header className="border-b border-zinc-100 bg-white px-4 pt-10 pb-8 dark:border-zinc-900 dark:bg-zinc-900/20">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                {greeting}, {firstName}
              </p>
              <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                <Sparkles className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
                AssiMate
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {assignments?.length ?? 0} active project marketplaces open
              </p>
            </div>
            
            <Link
              to="/post"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white shadow-sm transition-all hover:bg-zinc-800 active:scale-[0.98] dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              <Plus className="h-4 w-4" />
              <span>Post</span>
            </Link>
          </div>

          {/* Minimalist Context Tags */}
          <div className="mt-5 flex flex-wrap gap-3">
            <div className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <TrendingUp className="h-3.5 w-3.5 text-zinc-400" />
              <span>Real-time Bidding Active</span>
            </div>
            <span className="text-zinc-300 dark:text-zinc-800">•</span>
            <div className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <BookOpen className="h-3.5 w-3.5 text-zinc-400" />
              <span>Verified Student Network</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container Workspace */}
      <main className="mx-auto max-w-3xl px-4 pt-6">
        {/* Search Field */}
        <div className="relative mb-5">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-zinc-900 dark:text-zinc-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search active assignments by keyword..."
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 text-sm shadow-sm transition-all placeholder:text-zinc-400 focus-visible:border-zinc-400 focus-visible:ring-0 dark:border-zinc-800 dark:bg-zinc-900 dark:placeholder:text-zinc-500 dark:focus-visible:border-zinc-700"
          />
        </div>

        {/* Horizontal Scroll Subject Filters */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {SUBJECTS.map(({ label, emoji }) => {
            const isActive = subject === label;
            return (
              <button
                key={label}
                onClick={() => setSubject(label)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium border transition-all duration-150 ${
                  isActive
                    ? "bg-zinc-900 border-zinc-900 text-white dark:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-950 shadow-sm"
                    : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-200"
                }`}
              >
                <span>{emoji}</span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Assignment List Output */}
        <div className="space-y-3">
          {isLoading && Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}

          {!isLoading && filtered.length === 0 && (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-4 py-16 text-center dark:border-zinc-800 dark:bg-zinc-900/20">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-50 text-xl dark:bg-zinc-900">
                📚
              </div>
              <h3 className="mt-4 text-sm font-semibold text-zinc-900 dark:text-zinc-200">
                No assignments found
              </h3>
              <p className="mx-auto mt-1 max-w-xs text-xs text-zinc-500 dark:text-zinc-400">
                {search 
                  ? "We couldn't find matches for that specific query. Try checking your spelling or selecting another subject filter." 
                  : "The board is clear right now. Post your requirements to start receiving bids from expert freelancers immediately."}
              </p>
              
              <Link
                to="/post"
                className="mt-5 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-zinc-100 px-4 text-xs font-medium text-zinc-900 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
              >
                <Plus className="h-3.5 w-3.5" /> Post an assignment
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
                student: a.student ? { id: a.student_id, display_name: (a.student as any).display_name, avatar_url: (a.student as any).avatar_url } : null,
              }}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
