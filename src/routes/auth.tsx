import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : "/feed",
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [tab,           setTab]          = useState<"signup"|"signin">("signup");
  const [loading,       setLoading]      = useState(false);
  const [showPassword,  setShowPassword] = useState(false);
  const [email,         setEmail]        = useState("");
  const [password,      setPassword]     = useState("");
  const [displayName,   setDisplayName]  = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (tab === "signup") {
        if (!displayName.trim()) throw new Error("Please enter your name");
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/feed`,
            data: { display_name: displayName.trim() },
          },
        });
        if (error) throw error;
        toast.success("Account created! Welcome to AssiMate 🎉");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
      }
      navigate({ to: "/feed" });
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = async () => {
    if (!email) return toast.error("Enter your email first");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return toast.error(error.message);
    toast.success("Reset link sent — check your inbox");
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-primary-foreground relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/3 blur-3xl pointer-events-none" />
        <div className="relative flex items-center gap-2 mb-3">
          <Sparkles className="h-7 w-7" />
          <span className="font-bold text-2xl tracking-tight">AssiMate</span>
        </div>
        <h1 className="text-4xl font-bold text-center leading-tight max-w-xs">
          Assignment help on <span className="italic">your</span> budget
        </h1>
        <p className="mt-3 text-center text-primary-foreground/75 max-w-xs text-sm">
          Post assignments, place bids, chat, and get it done.
        </p>
      </div>

      {/* Card */}
      <div className="bg-card rounded-t-3xl px-5 pt-6 pb-10 shadow-glow-lg">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid grid-cols-2 w-full rounded-2xl mb-5">
            <TabsTrigger value="signup" className="rounded-xl">Sign up</TabsTrigger>
            <TabsTrigger value="signin" className="rounded-xl">Sign in</TabsTrigger>
          </TabsList>

          <form onSubmit={submit} className="space-y-3">
            {tab === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Your name</Label>
                <Input id="name" required value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Riya S." className="h-12 rounded-xl" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" className="h-12 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"}
                  required minLength={6} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="h-12 rounded-xl pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {tab === "signin" && (
              <button type="button" onClick={forgotPassword}
                className="text-xs text-primary hover:underline w-full text-right block">
                Forgot password?
              </button>
            )}
            <Button type="submit" disabled={loading}
              className="w-full h-12 text-base font-semibold bg-gradient-primary shadow-soft rounded-2xl mt-1">
              {loading
                ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{tab === "signup" ? "Creating…" : "Signing in…"}</span>
                : tab === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>
        </Tabs>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <Link to="/terms" className="underline hover:text-foreground">Terms</Link>{" & "}
          <Link to="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
        </p>

        <div className="mt-5 pt-4 border-t border-border flex flex-wrap gap-x-4 gap-y-1 justify-center">
          {(["/terms","/privacy","/refund","/about","/contact"] as const).map((href) => (
            <Link key={href} to={href} className="text-xs text-muted-foreground hover:text-foreground capitalize">
              {href.replace("/","")}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
