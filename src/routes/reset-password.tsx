import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase puts a recovery token in the URL hash; getSession picks it up.
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated — please sign in");
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col items-center justify-center px-6 text-primary-foreground">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-6 w-6" />
        <span className="font-semibold tracking-wide">AssiMate</span>
      </div>
      <div className="bg-card text-foreground rounded-3xl p-6 shadow-glow w-full max-w-sm mt-6">
        <h1 className="text-xl font-bold mb-1">Set a new password</h1>
        <p className="text-sm text-muted-foreground mb-4">
          {ready ? "Choose a strong password (min 6 characters)." : "Verifying your reset link…"}
        </p>
        {ready && (
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="np">New password</Label>
              <Input id="np" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-12 bg-gradient-primary">
              {loading ? "…" : "Update password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
