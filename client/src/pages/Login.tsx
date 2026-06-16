import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Login() {
  const [mode, setMode] = useState<"register" | "returning">("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [, navigate] = useLocation();
  const { isAuthenticated, user } = useAuth();

  // Self-register mutation — creates account + sends magic link
  const selfRegister = trpc.magicLink.selfRegister.useMutation({
    onSuccess: () => setSent(true),
    onError: (err) => setError(err.message),
  });

  // Returning client — just request a new link
  const requestLink = trpc.magicLink.request.useMutation({
    onSuccess: () => setSent(true),
    onError: (err) => setError(err.message),
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(user.role === "admin" ? "/coach" : "/dashboard");
    }
  }, [isAuthenticated, user, navigate]);

  if (isAuthenticated && user) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Enter your email address."); return; }
    if (mode === "register") {
      if (!name.trim()) { setError("Enter your first name."); return; }
      selfRegister.mutate({ name: name.trim(), email: email.trim().toLowerCase(), origin: window.location.origin });
    } else {
      requestLink.mutate({ email: email.trim().toLowerCase() });
    }
  };

  const isPending = selfRegister.isPending || requestLink.isPending;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card rounded-2xl p-8 border border-border">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="font-display text-2xl font-extrabold tracking-wide uppercase mb-1">
            THE HEALTHY <span className="text-teal">YINZER</span>
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-wide uppercase">
            Chain <span className="text-primary">Check</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
            {mode === "register"
              ? "Sign up to run your movement assessment. Coach Nick will see your results."
              : "Enter your email and we'll send a one-click login link."}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden mb-6">
          <button
            onClick={() => { setMode("register"); setError(""); setSent(false); }}
            className={`flex-1 py-2.5 text-sm font-display font-bold uppercase tracking-wider transition-colors ${
              mode === "register" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            New Here
          </button>
          <button
            onClick={() => { setMode("returning"); setError(""); setSent(false); }}
            className={`flex-1 py-2.5 text-sm font-display font-bold uppercase tracking-wider transition-colors ${
              mode === "returning" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Returning
          </button>
        </div>

        {!sent ? (
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "register" && (
              <Input
                type="text"
                placeholder="First name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-center text-lg"
                autoFocus
              />
            )}
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="text-center text-lg"
              autoFocus={mode === "returning"}
            />
            <Button
              type="submit"
              className="w-full font-display text-lg font-extrabold uppercase tracking-wider"
              disabled={isPending}
            >
              {isPending
                ? "Sending..."
                : mode === "register"
                ? "Get My Login Link"
                : "Send Login Link"}
            </Button>
            {error && (
              <p className="text-destructive text-sm text-center">{error}</p>
            )}
          </form>
        ) : (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-good/15 border-2 border-good flex items-center justify-center mx-auto">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <p className="font-display text-lg font-bold uppercase tracking-wider text-good">Link sent.</p>
              <p className="text-muted-foreground text-sm mt-1 leading-relaxed">
                Check your email and click the login link. It expires in 24 hours.
              </p>
            </div>
            <button
              onClick={() => { setSent(false); setError(""); }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Didn't get it? Try again
            </button>
          </div>
        )}


      </div>
    </div>
  );
}
