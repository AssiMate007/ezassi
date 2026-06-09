import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, IndianRupee, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/post")({
  component: PostPage,
});

const SUBJECTS = [
  { label: "Math",    emoji: "📐" },
  { label: "Science", emoji: "🔬" },
  { label: "English", emoji: "📝" },
  { label: "History", emoji: "📜" },
  { label: "Coding",  emoji: "💻" },
  { label: "Art",     emoji: "🎨" },
];

function PostPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [subject,     setSubject]     = useState("Math");
  const [budgetMin,   setBudgetMin]   = useState(100);
  const [budgetMax,   setBudgetMax]   = useState(500);
  const [deadline,    setDeadline]    = useState("");
  const [loading,     setLoading]     = useState(false);

  // Writers can't post — only students
  if (profile?.role === "writer") return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
      <div className="text-6xl mb-4">✍️</div>
      <h2 className="text-xl font-bold">You're a writer</h2>
      <p className="text-sm text-muted-foreground mt-2">Writers bid on assignments, they don't post them.</p>
      <button onClick={() => navigate({ to: "/feed" })}
        className="mt-4 text-primary text-sm underline">← Browse assignments</button>
    </div>
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (budgetMax < budgetMin) return toast.error("Max budget must be ≥ min budget");
    if (!deadline) return toast.error("Please set a deadline");
    if (new Date(deadline) < new Date()) return toast.error("Deadline must be in the future");

    setLoading(true);
    const { data, error } = await supabase.from("assignments").insert({
      student_id: user.id,
      title, description, subject,
      budget_min: budgetMin,
      budget_max: budgetMax,
      deadline: new Date(deadline).toISOString(),
    }).select("id").single();
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Assignment posted! Writers can now bid. 🎯");
    navigate({ to: "/assignment/$id", params: { id: data.id } });
  };

  // Min deadline = 1 hour from now
  const minDeadline = new Date(Date.now() + 3600_000).toISOString().slice(0, 16);

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="bg-gradient-hero px-4 pt-8 pb-16 text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="relative">
          <button onClick={() => navigate({ to: "/feed" })}
            className="mb-4 text-primary-foreground/80 hover:text-white flex items-center gap-1.5 text-sm transition">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Post an assignment</h1>
          </div>
          <p className="text-sm text-primary-foreground/75">Writers will bid — you pick the best price.</p>
        </div>
      </div>

      <div className="px-4 -mt-10 relative z-10">
        <form onSubmit={submit} className="space-y-4">
          {/* Title */}
          <div className="rounded-3xl bg-card border border-border shadow-card p-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title" className="font-semibold">What do you need help with?</Label>
              <Input
                id="title" required maxLength={120}
                value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Class 10 Algebra worksheet"
                className="rounded-xl h-12"
              />
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label className="font-semibold">Subject</Label>
              <div className="flex flex-wrap gap-2">
                {SUBJECTS.map(({ label, emoji }) => (
                  <button
                    type="button" key={label} onClick={() => setSubject(label)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${
                      subject === label
                        ? "border-primary bg-primary/10 text-primary scale-105"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <span>{emoji}</span>{label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="desc" className="font-semibold">Full details</Label>
              <Textarea
                id="desc" required rows={4}
                value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your assignment in detail — topic, format, any special requirements…"
                className="rounded-xl resize-none"
              />
            </div>
          </div>

          {/* Budget */}
          <div className="rounded-3xl bg-card border border-border shadow-card p-5">
            <Label className="font-semibold block mb-3">Your budget range</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="min" className="text-xs text-muted-foreground">Min (₹)</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="min" type="number" min={10}
                    value={budgetMin} onChange={(e) => setBudgetMin(+e.target.value)}
                    className="pl-9 rounded-xl" inputMode="numeric" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max" className="text-xs text-muted-foreground">Max (₹)</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="max" type="number" min={10}
                    value={budgetMax} onChange={(e) => setBudgetMax(+e.target.value)}
                    className="pl-9 rounded-xl" inputMode="numeric" />
                </div>
              </div>
            </div>
            <div className="mt-3 text-center text-sm text-muted-foreground bg-muted/50 rounded-xl py-2">
              Writers will bid between <strong className="text-primary">₹{budgetMin}</strong> and <strong className="text-primary">₹{budgetMax}</strong>
            </div>
          </div>

          {/* Deadline */}
          <div className="rounded-3xl bg-card border border-border shadow-card p-5">
            <Label htmlFor="deadline" className="font-semibold block mb-2">Deadline</Label>
            <Input
              id="deadline" type="datetime-local"
              required min={minDeadline}
              value={deadline} onChange={(e) => setDeadline(e.target.value)}
              className="rounded-xl h-12"
            />
            <p className="text-xs text-muted-foreground mt-2">Writers will only bid if they can meet your deadline.</p>
          </div>

          <Button type="submit" disabled={loading}
            className="w-full h-14 text-base font-bold bg-gradient-primary shadow-glow rounded-2xl">
            {loading
              ? <span className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" />Posting…</span>
              : <span className="flex items-center gap-2"><Sparkles className="h-5 w-5" />Post assignment 🎯</span>
            }
          </Button>
        </form>
      </div>
    </div>
  );
}
