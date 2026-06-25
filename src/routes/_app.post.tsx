import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, IndianRupee, Loader2, Globe, Calendar, Compass } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/post")({
  component: PostPage,
});

const SUBJECTS = [
  { label: "Math", emoji: "📐" },
  { label: "Science", emoji: "🔬" },
  { label: "English", emoji: "📝" },
  { label: "History", emoji: "📜" },
  { label: "Coding", emoji: "💻" },
  { label: "Art", emoji: "🎨" },
];

function PostPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("Math");
  const [budgetMin, setBudgetMin] = useState(100);
  const [budgetMax, setBudgetMax] = useState(500);
  const [deadline, setDeadline] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();

    if (trimmedTitle.length < 5) {
      return toast.error("Title must be at least 5 characters long");
    }
    if (trimmedDesc.length < 15) {
      return toast.error("Description must be at least 15 characters long");
    }
    if (trimmedDesc.length > 10000) {
      return toast.error("Description cannot exceed 10000 characters");
    }

    if (budgetMin < 10) {
      return toast.error("Minimum budget must be at least ₹10");
    }
    if (budgetMax > 10000000) {
      return toast.error("Maximum budget cannot exceed ₹10,000,000");
    }
    if (budgetMax < budgetMin) {
      return toast.error("Max budget must be ≥ min budget");
    }

    if (!deadline) return toast.error("Please set a deadline");
    if (new Date(deadline) < new Date()) return toast.error("Deadline must be in the future");

    setLoading(true);
    const { data, error } = await supabase.from("assignments").insert({
      student_id: user.id,
      title: trimmedTitle,
      description: trimmedDesc,
      subject,
      budget_min: budgetMin,
      budget_max: budgetMax,
      deadline: new Date(deadline).toISOString(),
    }).select("id").single();
    
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Assignment posted! Writers can now bid. 🎯");
    navigate({ to: "/assignment/$id", params: { id: data.id } });
  };

  const minDeadline = new Date(Date.now() + 3600_000).toISOString().slice(0, 16);

  return (
    <div className="min-h-screen bg-white pb-32 dark:bg-zinc-950">
      {/* Premium Sticky Action Header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-100 bg-white/80 px-4 backdrop-blur-md dark:border-zinc-900 dark:bg-zinc-950/80">
        <button
          type="button"
          onClick={() => navigate({ to: "/feed" })}
          className="flex items-center gap-1 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Cancel</span>
        </button>
        <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">New Assignment</h1>
        <button
          type="submit"
          form="assignment-form"
          disabled={loading || !title || !description || !deadline}
          className="flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white transition-all hover:bg-zinc-800 disabled:opacity-30 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {loading && <Loader2 className="h-3 w-3 animate-spin" />}
          <span>{loading ? "Publishing" : "Publish"}</span>
        </button>
      </header>

      <div className="mx-auto max-w-md px-4 pt-6">
        {/* Visibility context badge */}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-zinc-100 bg-zinc-50 px-3 py-1 text-[11px] font-medium text-zinc-600 dark:border-zinc-800/60 dark:bg-zinc-900/40 dark:text-zinc-400">
          <Globe className="h-3 w-3 opacity-70" />
          <span>Open to all verified platform writers</span>
        </div>

        <form id="assignment-form" onSubmit={submit} className="mt-6 space-y-6">
          {/* Main Title Input */}
          <div className="space-y-1">
            <input
              type="text"
              required
              maxLength={120}
              placeholder="What do you need help with?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent text-xl font-bold tracking-tight text-zinc-900 placeholder-zinc-300 focus:outline-none dark:text-zinc-50 dark:placeholder-zinc-700"
            />
          </div>

          {/* Subject Filter Chips */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              <Compass className="h-3.5 w-3.5" />
              <span>Subject Category</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SUBJECTS.map(({ label, emoji }) => {
                const isSelected = subject === label;
                return (
                  <button
                    type="button"
                    key={label}
                    onClick={() => setSubject(label)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-all active:scale-95 ${
                      isSelected
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                        : "border-zinc-100 bg-zinc-50 text-zinc-600 hover:border-zinc-200 dark:border-zinc-900 dark:bg-zinc-900/40 dark:text-zinc-400"
                    }`}
                  >
                    <span>{emoji}</span>
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <hr className="border-zinc-100 dark:border-zinc-900" />

          {/* Core Body Description Textarea */}
          <div className="space-y-1">
            <textarea
              required
              rows={8}
              placeholder="Provide clean instructions, specific problem sets, deliverables, or structure requirements..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full resize-none bg-transparent text-sm leading-relaxed text-zinc-600 placeholder-zinc-400 focus:outline-none dark:text-zinc-400 dark:placeholder-zinc-600"
            />
          </div>

          <hr className="border-zinc-100 dark:border-zinc-900" />

          {/* Parameters Metadata Block */}
          <div className="space-y-5 rounded-2xl bg-zinc-50/50 p-4 dark:bg-zinc-900/20">
            {/* Dual Budget Inputs */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                <IndianRupee className="h-3.5 w-3.5" />
                <span>Budget Envelope (INR)</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-xs font-medium text-zinc-400">Min</span>
                  <input
                    type="number"
                    min={10}
                    inputMode="numeric"
                    value={budgetMin}
                    onChange={(e) => setBudgetMin(+e.target.value)}
                    className="w-full rounded-xl border border-zinc-100 bg-white py-2 pl-10 pr-3 text-xs font-semibold text-zinc-800 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                  />
                </div>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-xs font-medium text-zinc-400">Max</span>
                  <input
                    type="number"
                    min={10}
                    inputMode="numeric"
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(+e.target.value)}
                    className="w-full rounded-xl border border-zinc-100 bg-white py-2 pl-11 pr-3 text-xs font-semibold text-zinc-800 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                  />
                </div>
              </div>
            </div>

            {/* Target Timeline Field */}
            <div className="space-y-2">
              <label htmlFor="deadline" className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                <Calendar className="h-3.5 w-3.5" />
                <span>Target Deadline</span>
              </label>
              <input
                id="deadline"
                type="datetime-local"
                required
                min={minDeadline}
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full rounded-xl border border-zinc-100 bg-white px-3 py-2 text-xs font-medium text-zinc-800 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
