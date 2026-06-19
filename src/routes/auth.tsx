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
  const [tab,          setTab]          = useState<"signup"|"signin">("signup");
  const [loading,      setLoading]      = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [displayName,  setDisplayName]  = useState("");

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
    <div className="min-h-screen bg-zinc-50/50 dark:bg-zinc-950 flex flex-col">
      {/* Header — matches Feed page structure */}
      <header className="border-b border-zinc-100 bg-white px-4 pt-14 pb-10 dark:border-zinc-900 dark:bg-zinc-900/20">
        <div className="mx-auto max-w-3xl flex flex-col items-center text-center">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-10 w-10 rounded-2xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white dark:text-zinc-900" />
            </div>
            <span className="font-bold text-xl tracking-tight text-zinc-900 dark:text-zinc-50">AssiMate</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 max-w-xs leading-snug">
            Assignment help on your budget
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-xs">
            Post assignments, place bids, chat, and get it done.
          </p>
        </div>
      </header>

      {/* Form card */}
      <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-12 flex-1">
        <div className="mx-auto max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="grid grid-cols-2 w-full rounded-xl mb-5 bg-zinc-100 dark:bg-zinc-800">
              <TabsTrigger value="signup" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900">Sign up</TabsTrigger>
              <TabsTrigger value="signin" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900">Sign in</TabsTrigger>
            </TabsList>

            <form onSubmit={submit} className="space-y-3">
              {tab === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-zinc-700 dark:text-zinc-300">Your name</Label>
                  <Input id="name" required value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Riya S." className="h-11 rounded-xl border-zinc-200 dark:border-zinc-800" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-zinc-700 dark:text-zinc-300">Email</Label>
                <Input id="email" type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" className="h-11 rounded-xl border-zinc-200 dark:border-zinc-800" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-zinc-700 dark:text-zinc-300">Password</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"}
                    required minLength={6} value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className="h-11 rounded-xl pr-10 border-zinc-200 dark:border-zinc-800" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {tab === "signin" && (
                <button type="button" onClick={forgotPassword}
                  className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 w-full text-right block transition">
                  Forgot password?
                </button>
              )}
              <Button type="submit" disabled={loading}
                className="w-full h-11 text-sm font-semibold bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200 rounded-xl mt-1 shadow-sm">
                {loading
                  ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{tab === "signup" ? "Creating…" : "Signing in…"}</span>
                  : tab === "signup" ? "Create account" : "Sign in"}
              </Button>
            </form>
          </Tabs>

          <p className="mt-5 text-center text-xs text-zinc-400 dark:text-zinc-500">
            By continuing you agree to our{" "}
            <Link to="/terms" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">Terms</Link>{" & "}
            <Link to="/privacy" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">Privacy Policy</Link>.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-x-4 gap-y-1 justify-center">
          {(["/terms","/privacy","/refund","/about","/contact"] as const).map((href) => (
            <Link key={href} to={href} className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 capitalize transition">
              {href.replace("/","")}
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
