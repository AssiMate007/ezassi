import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, IndianRupee } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/post")({
  component: PostPage,
});

const SUBJECTS = ["Math", "Science", "English", "History", "Coding", "Art"];

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
    if (budgetMax < budgetMin) {
      toast.error("Max budget must be ≥ min budget");
      return;
    }
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
    toast.success("Posted! Writers can now bid. 🎯");
    navigate({ to: "/assignment/$id", params: { id: data.id } });
  };

  return (
    <div className="px-4 pt-6 pb-4">
      <button onClick={() => navigate({ to: "/feed" })} className="mb-4 text-muted-foreground flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <h1 className="text-2xl font-bold mb-1">Post an assignment</h1>
      <p className="text-sm text-muted-foreground mb-6">Tell writers what you need help with.</p>

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Class 10 Algebra worksheet" />
        </div>
        <div className="space-y-1.5">
          <Label>Subject</Label>
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map((s) => (
              <button type="button" key={s} onClick={() => setSubject(s)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition ${
                  subject === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                }`}>{s}</button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="desc">Description</Label>
          <Textarea id="desc" required rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Full details, attachments, etc." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="min">Min budget (₹)</Label>
            <div className="relative">
              <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="min" type="number" min={10} value={budgetMin} onChange={(e) => setBudgetMin(+e.target.value)} className="pl-8" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="max">Max budget (₹)</Label>
            <div className="relative">
              <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="max" type="number" min={10} value={budgetMax} onChange={(e) => setBudgetMax(+e.target.value)} className="pl-8" />
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="deadline">Deadline</Label>
          <Input id="deadline" type="datetime-local" required value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
        <Button type="submit" disabled={loading} className="w-full h-12 bg-gradient-primary shadow-soft">
          {loading ? "Posting…" : "Post assignment"}
        </Button>
      </form>
    </div>
  );
}
