import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sparkles, GraduationCap, PenLine, Eye, EyeOff, Shield } from "lucide-react";
import { toast } from "sonner";

const ADMIN_EMAIL = "assimate007@gmail.com";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : "/feed",
  }),
  component: AuthPage,
});

type Portal = "user" | "admin";

function AuthPage() {
  const navigate = useNavigate();
  const [portal, setPortal] = useState<Portal>("user");
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"student" | "writer">("student");

  const isAdmin = portal === "admin";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const useEmail = isAdmin ? ADMIN_EMAIL : email;
      if (!isAdmin && mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: useEmail, password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName, role },
          },
        });
        if (error) throw error;
        toast.success("Welcome! 🎉 You're in.");
      } else {
        // Admin: try sign-in; if account doesn't exist yet, auto-create it so the trigger grants the admin role.
        const { error } = await supabase.auth.signInWithPassword({ email: useEmail, password });
        if (error) {
          if (isAdmin && /invalid login|invalid credentials/i.test(error.message)) {
            const { error: sErr } = await supabase.auth.signUp({
              email: useEmail, password,
              options: { emailRedirectTo: window.location.origin, data: { display_name: "Admin", role: "student" } },
            });
            if (sErr) throw sErr;
            toast.success("Admin account created");
          } else {
            throw error;
          }
        } else {
          toast.success(isAdmin ? "Welcome, Admin" : "Welcome back!");
        }
      }
      navigate({ to: isAdmin ? "/admin" : "/feed" });
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
        {/* Portal switcher */}
        <div className="grid grid-cols-2 gap-2 mb-4 p-1 bg-muted rounded-xl">
          <button
            type="button"
            onClick={() => setPortal("user")}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition ${portal === "user" ? "bg-card shadow-soft text-foreground" : "text-muted-foreground"}`}
          >
            <GraduationCap className="h-4 w-4" /> Student / Writer
          </button>
          <button
            type="button"
            onClick={() => { setPortal("admin"); setMode("signin"); }}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition ${portal === "admin" ? "bg-card shadow-soft text-foreground" : "text-muted-foreground"}`}
          >
            <Shield className="h-4 w-4" /> Admin
          </button>
        </div>

        {!isAdmin ? (
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
              <PasswordField value={password} onChange={setPassword} show={showPassword} setShow={setShowPassword} />
              <Button type="submit" disabled={loading} className="w-full h-12 text-base bg-gradient-primary shadow-soft">
                {loading ? "…" : mode === "signup" ? "Create account" : "Sign in"}
              </Button>
            </form>
          </Tabs>
        ) : (
          <form onSubmit={submit} className="space-y-4 mt-2">
            <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-3 flex items-center gap-3">
              <Shield className="h-5 w-5 text-primary" />
              <div className="text-sm">
                <p className="font-semibold">Admin portal</p>
                <p className="text-xs text-muted-foreground">Owner-only access</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Admin email</Label>
              <Input value={ADMIN_EMAIL} readOnly disabled />
            </div>
            <PasswordField value={password} onChange={setPassword} show={showPassword} setShow={setShowPassword} />
            <Button type="submit" disabled={loading} className="w-full h-12 text-base bg-gradient-primary shadow-soft">
              {loading ? "…" : "Enter admin panel"}
            </Button>
          </form>
        )}

        <p className="mt-5 text-center text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <a href="/terms" className="underline hover:text-foreground">Terms</a> &{" "}
          <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a>.
        </p>
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
