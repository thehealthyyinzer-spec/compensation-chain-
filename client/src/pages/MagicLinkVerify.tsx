import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation, useSearch } from "wouter";
import { Loader2 } from "lucide-react";

export default function MagicLinkVerify() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const [error, setError] = useState("");

  const params = new URLSearchParams(search);
  const token = params.get("token") || "";

  const verify = trpc.magicLink.verify.useMutation({
    onSuccess: () => {
      // Redirect to client dashboard after successful verification
      navigate("/dashboard");
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  useEffect(() => {
    if (token) {
      verify.mutate({ token });
    } else {
      setError("No token provided. Check the link from your email.");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card rounded-2xl p-8 border border-border text-center">
        {error ? (
          <>
            <h2 className="font-display text-2xl font-extrabold uppercase text-destructive mb-3">
              Link Error
            </h2>
            <p className="text-muted-foreground text-sm">{error}</p>
            <a
              href="/login"
              className="inline-block mt-4 text-primary text-sm font-semibold hover:underline"
            >
              Request a new link →
            </a>
          </>
        ) : (
          <>
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground text-sm">Verifying your login link...</p>
          </>
        )}
      </div>
    </div>
  );
}
