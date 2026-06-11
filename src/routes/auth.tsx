import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : "/feed",
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signup" | "signin">("signup");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (tab === "signup") {
        if (!displayName.trim()) throw new Error("Please enter your name");
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/feed`,
            data: { display_name: displayName.trim() },
          },
        });
        if (error) throw error;
        toast.success("Account created! Welcome to AssiMate 🎉");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
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
      if (error) throw error;
      // browser redirects — no further action needed
    } catch (err: any) {
      toast.error(
        err?.message?.includes("provider is not enabled")
          ? "Google sign-in is not enabled yet. Please enable it in Supabase → Authentication → Providers → Google."
          : err?.message ?? "Google sign-in failed"
      );
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {tab === "signup" ? "Get started" : "Welcome back"}
          </h1>
          <p className="text-gray-600">
            {tab === "signup"
              ? "Join AssiMate and find assignment help"
              : "Sign in to your account"}
          </p>
        </div>

        {/* Google Sign In Button */}
        <Button
          type="button"
          variant="outline"
          className="w-full h-11 rounded-lg gap-2 mb-5 font-medium border-gray-300 hover:bg-gray-50 text-gray-900"
          onClick={signInWithGoogle}
          disabled={googleLoading}
        >
          {googleLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path
                d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908C16.618 14.215 17.64 11.927 17.64 9.2z"
                fill="#4285F4"
              />
              <path
                d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
                fill="#34A853"
              />
              <path
                d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                fill="#FBBC05"
              />
              <path
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                fill="#EA4335"
              />
            </svg>
          )}
          Sign in with Google
        </Button>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">or continue with email</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="space-y-4">
          {/* Tab Switch */}
          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => setTab("signup")}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-colors ${
                tab === "signup"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Sign up
            </button>
            <button
              type="button"
              onClick={() => setTab("signin")}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-colors ${
                tab === "signin"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Sign in
            </button>
          </div>

          {/* Name Field */}
          {tab === "signup" && (
            <div>
              <Label htmlFor="name" className="text-sm font-medium text-gray-700 mb-1.5 block">
                Full name
              </Label>
              <Input
                id="name"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Riya Sharma"
                className="h-10 rounded-lg border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Email Field */}
          <div>
            <Label htmlFor="email" className="text-sm font-medium text-gray-700 mb-1.5 block">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-10 rounded-lg border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Password Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                Password
              </Label>
              {tab === "signin" && (
                <button
                  type="button"
                  onClick={forgotPassword}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Forgot?
                </button>
              )}
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="h-10 rounded-lg border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-10 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg mt-6"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {tab === "signup" ? "Creating..." : "Signing in..."}
              </span>
            ) : tab === "signup" ? (
              "Create account"
            ) : (
              "Sign in"
            )}
          </Button>
        </form>

        {/* Toggle Auth Type */}
        <p className="text-center text-sm text-gray-600 mt-4">
          {tab === "signup" ? "Already have an account? " : "Don't have an account? "}
          <button
            type="button"
            onClick={() => setTab(tab === "signup" ? "signin" : "signup")}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            {tab === "signup" ? "Sign in" : "Sign up"}
          </button>
        </p>

        {/* Footer Links */}
        <p className="mt-6 text-center text-xs text-gray-500">
          By continuing you agree to our{" "}
          <Link to="/terms" className="text-blue-600 hover:text-blue-700 underline">
            Terms
          </Link>{" "}
          &{" "}
          <Link to="/privacy" className="text-blue-600 hover:text-blue-700 underline">
            Privacy Policy
          </Link>
        </p>

        {/* Legal Links */}
        <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-x-3 gap-y-2 justify-center">
          {(["/about", "/contact"] as const).map((href) => (
            <Link
              key={href}
              to={href}
              className="text-xs text-gray-500 hover:text-gray-700 capitalize"
            >
              {href.replace("/", "")}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
