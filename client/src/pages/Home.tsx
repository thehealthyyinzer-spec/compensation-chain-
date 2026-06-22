import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading) {
      if (isAuthenticated && user) {
        // Authenticated — send to the right dashboard
        navigate(user.role === "admin" ? "/coach" : "/dashboard");
      } else {
        // Not authenticated — go straight to login
        navigate("/login");
      }
    }
  }, [loading, isAuthenticated, user, navigate]);

  // Show spinner while auth resolves
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
