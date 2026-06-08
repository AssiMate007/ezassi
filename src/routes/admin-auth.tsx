import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Eye, EyeOff, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin-auth")({
  component: AdminAuthPage,
});

function AdminAuthPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: "assimate007@gmail.com",
        password,
      });
      if (error) throw new Error("Invalid admin password");

      // Verify the signed-in user actually has admin role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleData) {
        await supabase.auth.signOut();
        throw new Error("Access denied — not an admin account");
      }

      toast.success("Welcome, Admin 👋");
      navigate({ to: "/admin" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 mb-8 text-primary-foreground">
        <Sparkles className="h-5 w-5" />
        <span className="font-bold text-lg">AssiMate</span>
      </Link>

      <div className="w-full max-w-sm bg-card rounded-3xl shadow-glow p-6">
        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="h-14 w-14 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-soft mb-3">
            <Shield className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold">Admin portal</h1>
          <p className="text-sm text-muted-foreground mt-1">Owner-only access</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">Admin password</Label>
            <div className="relative">
              <Input
                id="password"
                type={show ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="pr-10"
                autoFocus
              />
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

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 text-base bg-gradient-primary shadow-soft"
          >
            {loading ? "Verifying…" : "Enter admin panel"}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Not an admin?{" "}
          <Link to="/auth" className="text-primary underline hover:text-primary/80">
            Go to regular sign in
          </Link>
        </p>
      </div>

      {/* Security notice */}
      <p className="mt-6 text-xs text-primary-foreground/60 text-center max-w-xs">
        This page is for platform owners only. Unauthorized access attempts are logged.
      </p>
    </div>
  );
}
