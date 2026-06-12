import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      if (user.role === "admin") {
        navigate("/coach");
      } else {
        navigate("/dashboard");
      }
    }
  }, [loading, isAuthenticated, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="text-center max-w-lg">
        <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-wide uppercase mb-2">
          CHAIN <span className="text-teal">CHECK</span>
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed mb-8">
          Your movement assessment dashboard. Track compensation patterns, watch the chain rebuild, and stay connected with Coach Nick through every checkpoint.
        </p>

        <div className="space-y-3">
          <Button
            onClick={() => navigate("/login")}
            className="w-full font-display text-lg font-extrabold uppercase tracking-wider"
          >
            Client Login
          </Button>
          <p className="text-xs text-muted-foreground">
            Coach Nick sends you a login link by email. If you don't have one yet, this isn't for you ... try the free Chain Check first.
          </p>
        </div>
      </div>

      <footer className="absolute bottom-6 text-center">
        <p className="text-xs text-muted-foreground">
          A coaching tool by The Healthy Yinzer · Not medical advice
        </p>
      </footer>
    </div>
  );
}
