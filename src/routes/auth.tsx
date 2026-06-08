import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
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
        toast.success("Welcome! You're in.");
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

  const forgotPassword = async (addr: string) => {
    if (!addr) return toast.error("Enter your email first");
    const { error } = await supabase.auth.resetPasswordForEmail(addr, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return toast.error(error.message);
    toast.success("Reset link sent — check your inbox");
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/feed` },
    });
    if (error) toast.error(error.message);
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

          {/* Google SSO */}
          <Button
            type="button"
            variant="outline"
            className="w-full mt-5 h-11 gap-2"
            onClick={signInWithGoogle}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908C16.618 14.215 17.64 11.927 17.64 9.2z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </Button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            {/* Role picker — only shown on Sign Up tab */}
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

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <PasswordField value={password} onChange={setPassword} show={showPassword} setShow={setShowPassword} />

            {/* Forgot password — only on Sign In */}
            {mode === "signin" && (
              <button type="button" onClick={() => forgotPassword(email)} className="text-xs text-primary hover:underline block w-full text-right -mt-1">
                Forgot password?
              </button>
            )}

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

        {/* Footer links on auth page */}
        <div className="mt-6 pt-4 border-t border-border flex flex-wrap gap-x-4 gap-y-1 justify-center">
          <Link to="/terms" className="text-xs text-muted-foreground hover:text-foreground">Terms</Link>
          <Link to="/privacy" className="text-xs text-muted-foreground hover:text-foreground">Privacy</Link>
          <Link to="/refund" className="text-xs text-muted-foreground hover:text-foreground">Refunds</Link>
          <Link to="/about" className="text-xs text-muted-foreground hover:text-foreground">About</Link>
          <Link to="/contact" className="text-xs text-muted-foreground hover:text-foreground">Contact</Link>
        </div>
      </div>
    </div>
  );
}

function PasswordField({ value, onChange, show, setShow }: { value: string; onChange: (v: string) => void; show: boolean; setShow: (v: boolean) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="password">Password</Label>
      <div className="relative">
        <Input id="password" type={show ? "text" : "password"} required minLength={6} value={value} onChange={(e) => onChange(e.target.value)} className="pr-10" />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
