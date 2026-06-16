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
  const [googleLoading, setGoogleLoading]= useState(false);
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

  const signInWithGoogle = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/feed`,
        },
      });
      if (error) {
        // If provider not enabled, show setup instructions
        if (error.message?.toLowerCase().includes("provider") || error.message?.toLowerCase().includes("not enabled")) {
          toast.error("Google sign-in needs to be enabled in Supabase first — see instructions below", { duration: 6000 });
        } else {
          throw error;
        }
      }
      // On success browser redirects — no action needed
    } catch (err: any) {
      toast.error(err?.message ?? "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
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

          {/* Google */}
          <Button
            type="button" variant="outline"
            className="w-full h-12 rounded-2xl gap-2 mb-4 font-medium"
            onClick={signInWithGoogle}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908C16.618 14.215 17.64 11.927 17.64 9.2z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
            )}
            Continue with Google
          </Button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

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
