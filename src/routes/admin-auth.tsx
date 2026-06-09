import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Eye, EyeOff, Sparkles, Lock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin-auth")({
  component: AdminAuthPage,
});

// Rate limiting: max 5 attempts per 10 min
const attempts: number[] = [];
function checkRateLimit(): boolean {
  const now = Date.now();
  const window = 10 * 60 * 1000;
  const recent = attempts.filter((t) => now - t < window);
  attempts.length = 0;
  attempts.push(...recent);
  if (recent.length >= 5) return false;
  attempts.push(now);
  return true;
}

function AdminAuthPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkRateLimit()) {
      setBlocked(true);
      toast.error("Too many attempts. Wait 10 minutes.");
      return;
    }
    setLoading(true);
    try {
      // Sign in with the admin email
      const { data, error } = await supabase.auth.signInWithPassword({
        email: "assimate007@gmail.com",
        password,
      });
      if (error) throw new Error("Invalid password");

      // SECURITY: verify admin role in user_roles table
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (roleError || !roleData) {
        // Sign them back out immediately
        await supabase.auth.signOut();
        throw new Error("Access denied");
      }

      toast.success("Welcome back, Admin 👋");
      navigate({ to: "/admin" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      setPassword("");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-black/10 blur-3xl pointer-events-none" />

      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 mb-8 text-primary-foreground z-10">
        <Sparkles className="h-5 w-5" />
        <span className="font-bold text-lg tracking-tight">AssiMate</span>
      </Link>

      <div className="w-full max-w-sm z-10">
        <div className="bg-card/95 backdrop-blur-xl rounded-3xl shadow-glow border border-border/50 p-7">
          {/* Icon */}
          <div className="flex flex-col items-center mb-6">
            <div className="h-16 w-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow mb-4">
              <Shield className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold">Admin Portal</h1>
            <p className="text-sm text-muted-foreground mt-1 text-center">Owner-only access · Secured</p>
          </div>

          {blocked && (
            <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
              <Lock className="h-4 w-4 shrink-0" />
              Too many attempts. Try again in 10 minutes.
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">Admin password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={show ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="pr-10 h-12 rounded-xl bg-muted/50 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  autoFocus
                  disabled={blocked}
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                  aria-label={show ? "Hide" : "Show"}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || blocked}
              className="w-full h-12 text-base font-semibold bg-gradient-primary shadow-soft hover:shadow-glow transition-all"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Verifying…
                </span>
              ) : "Enter admin panel"}
            </Button>
          </form>

          <div className="mt-5 pt-4 border-t border-border/50 text-center">
            <Link to="/auth" className="text-sm text-muted-foreground hover:text-primary transition">
              ← Regular sign in
            </Link>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-primary-foreground/50">
          Unauthorized access is prohibited. All attempts are logged.
        </p>
      </div>
    </div>
  );
}
