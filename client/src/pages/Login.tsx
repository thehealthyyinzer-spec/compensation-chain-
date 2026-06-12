import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [magicUrl, setMagicUrl] = useState("");
  const [error, setError] = useState("");
  const [, navigate] = useLocation();
  const { isAuthenticated, user } = useAuth();

  const requestLink = trpc.magicLink.request.useMutation({
    onSuccess: (data) => {
      setSent(true);
      // In dev/testing, show the link directly
      const url = `${window.location.origin}/verify?token=${data.token}`;
      setMagicUrl(url);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  // If already authenticated, redirect
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === "admin") {
        navigate("/coach");
      } else {
        navigate("/dashboard");
      }
    }
  }, [isAuthenticated, user, navigate]);

  if (isAuthenticated && user) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }
    requestLink.mutate({ email: email.trim().toLowerCase() });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card rounded-2xl p-8 border border-border">
        <div className="text-center mb-6">
          <h1 className="font-display text-3xl font-extrabold tracking-wide uppercase">
            Your Chain <span className="text-teal">Dashboard</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
            Enter the email Coach Nick has on file for you. We'll send a one-click login link.
          </p>
        </div>

        {!sent ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="text-center text-lg"
            />
            <Button
              type="submit"
              className="w-full font-display text-lg font-extrabold uppercase tracking-wider"
              disabled={requestLink.isPending}
            >
              {requestLink.isPending ? "Sending..." : "Send Login Link"}
            </Button>
            {error && (
              <p className="text-destructive text-sm text-center">{error}</p>
            )}
          </form>
        ) : (
          <div className="text-center space-y-4">
            <div className="bg-primary/10 border border-primary/30 rounded-xl p-4">
              <p className="text-primary font-semibold text-sm">Link sent.</p>
              <p className="text-muted-foreground text-xs mt-1">
                Check your email and click the login link. It expires in 30 minutes.
              </p>
            </div>
            {magicUrl && (
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Dev mode — click to login:</p>
                <a href={magicUrl} className="text-primary text-xs break-all underline">
                  {magicUrl}
                </a>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-muted-foreground text-xs mb-3">Coach Nick?</p>
          <a
            href={getLoginUrl()}
            className="text-primary text-sm font-semibold hover:underline"
          >
            Sign in with Manus →
          </a>
        </div>
      </div>
    </div>
  );
}
