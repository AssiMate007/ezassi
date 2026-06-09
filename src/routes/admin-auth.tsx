import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Eye, EyeOff, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin-auth")({
  component: AdminAuthPage,
});

const attempts: number[] = [];
function rateOk() {
  const now = Date.now();
  const recent = attempts.filter((t) => now - t < 600_000);
  attempts.length = 0; attempts.push(...recent);
  if (recent.length >= 5) return false;
  attempts.push(now); return true;
}

function AdminAuthPage() {
  const [password, setPassword] = useState("");
  const [show, setShow]         = useState(false);
  const [loading, setLoading]   = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rateOk()) return toast.error("Too many attempts — wait 10 min");
    setLoading(true);
    try {
      // 1. Sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email: "assimate007@gmail.com",
        password,
      });
      if (error) throw new Error("Incorrect password");

      // 2. Ensure admin row exists (auto-heal if migration missed it)
      const userId = data.user.id;
      const { data: existing } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (!existing) {
        const { error: insertErr } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: "admin" });
        if (insertErr) {
          await supabase.auth.signOut();
          throw new Error("Could not set admin role — run the SQL fix below");
        }
      }

      toast.success("Welcome, Admin! 👋");
      // Hard reload so the admin hook re-queries with fresh session
      window.location.replace("/admin");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setPassword("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-black/10 blur-3xl pointer-events-none" />

      <Link to="/" className="flex items-center gap-2 mb-8 text-primary-foreground z-10">
        <Sparkles className="h-5 w-5" />
        <span className="font-bold text-lg tracking-tight">AssiMate</span>
      </Link>

      <div className="w-full max-w-sm z-10">
        <div className="bg-card/95 backdrop-blur-xl rounded-3xl shadow-glow border border-border/50 p-7">
          <div className="flex flex-col items-center mb-6">
            <div className="h-16 w-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow mb-4 animate-glow-pulse">
              <Shield className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold">Admin Portal</h1>
            <p className="text-sm text-muted-foreground mt-1 text-center">
              assimate007@gmail.com
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pw">Password</Label>
              <div className="relative">
                <Input
                  id="pw"
                  type={show ? "text" : "password"}
                  required minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className="pr-10 h-12 rounded-xl"
                  autoFocus
                />
                <button type="button" onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={loading}
              className="w-full h-12 text-base font-semibold bg-gradient-primary shadow-soft rounded-2xl">
              {loading
                ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Signing in…</span>
                : "Enter admin panel"}
            </Button>
          </form>

          <div className="mt-5 pt-4 border-t border-border/50">
            <p className="text-xs font-semibold text-muted-foreground mb-2">If admin tab still doesn't appear, run this in Supabase SQL editor:</p>
            <pre className="text-[10px] bg-muted rounded-xl p-3 overflow-x-auto text-muted-foreground font-mono leading-relaxed whitespace-pre-wrap break-all">
{`INSERT INTO user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users
WHERE email = 'assimate007@gmail.com'
ON CONFLICT DO NOTHING;`}
            </pre>
          </div>

          <div className="mt-4 text-center">
            <Link to="/auth" className="text-sm text-muted-foreground hover:text-primary transition">
              ← Regular sign in
            </Link>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-primary-foreground/40">
          Unauthorized access is prohibited.
        </p>
      </div>
    </div>
  );
}
