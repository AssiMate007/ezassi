import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sparkles, GraduationCap, PenLine, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : "/feed",
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"student" | "writer">("student");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName, role },
          },
        });
        if (error) throw error;
        toast.success("Welcome! 🎉 You're in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
      }
      navigate({ to: "/feed" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-primary-foreground">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-6 w-6" />
          <span className="font-semibold tracking-wide">AssiMate</span>
        </div>
        <h1 className="text-4xl font-bold text-center leading-tight max-w-xs">
          Your assignment <span className="italic">mate</span>, on your budget
        </h1>
        <p className="mt-3 text-center text-primary-foreground/85 max-w-xs">
          Post your assignment, get bids, chat, and pick your mate.
        </p>
      </div>

      <div className="bg-card rounded-t-3xl px-6 pt-6 pb-10 shadow-glow">
        <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="signup">Sign up</TabsTrigger>
            <TabsTrigger value="signin">Sign in</TabsTrigger>
          </TabsList>

          <form onSubmit={submit} className="space-y-4 mt-5">
            {mode === "signup" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="name">Display name</Label>
                  <Input id="name" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Riya S." />
                </div>
                <div className="space-y-2">
                  <Label>I'm a…</Label>
                  <RadioGroup value={role} onValueChange={(v) => setRole(v as typeof role)} className="grid grid-cols-2 gap-2">
                    <label className={`flex items-center gap-2 rounded-xl border-2 p-3 cursor-pointer transition ${role === "student" ? "border-primary bg-primary/5" : "border-border"}`}>
                      <RadioGroupItem value="student" className="sr-only" />
                      <GraduationCap className="h-5 w-5 text-primary" />
                      <span className="text-sm font-medium">Student</span>
                    </label>
                    <label className={`flex items-center gap-2 rounded-xl border-2 p-3 cursor-pointer transition ${role === "writer" ? "border-primary bg-primary/5" : "border-border"}`}>
                      <RadioGroupItem value="writer" className="sr-only" />
                      <PenLine className="h-5 w-5 text-primary" />
                      <span className="text-sm font-medium">Writer</span>
                    </label>
                  </RadioGroup>
                </div>
              </>
            )}
            <TabsContent value="signin" className="m-0" />
            <TabsContent value="signup" className="m-0" />
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full h-12 text-base bg-gradient-primary shadow-soft">
              {loading ? "…" : mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>
        </Tabs>
        <p className="mt-5 text-center text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <a href="/terms" className="underline hover:text-foreground">Terms</a> &{" "}
          <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
