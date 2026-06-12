import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { computeScanStatus } from "@/lib/scanUtils";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function CoachDashboard() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const { data: clients, isLoading } = trpc.admin.clients.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
  });

  // Add client form
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", email: "", program: "rebuild" as const, startDate: new Date().toISOString().split("T")[0] });

  const createClient = trpc.admin.createClient.useMutation({
    onSuccess: () => {
      toast.success("Client added.");
      setShowAddClient(false);
      setNewClient({ name: "", email: "", program: "rebuild", startDate: new Date().toISOString().split("T")[0] });
    },
  });

  // GHL trigger
  const [triggerClientId, setTriggerClientId] = useState<number | null>(null);
  const [ghlTag, setGhlTag] = useState("");
  const triggerWebhook = trpc.admin.triggerWebhook.useMutation({
    onSuccess: () => {
      toast.success("GHL trigger sent.");
      setTriggerClientId(null);
      setGhlTag("");
    },
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "admin") {
    navigate("/login");
    return null;
  }

  const getStatus = (latestSession: any) => {
    if (!latestSession) return "—";
    return computeScanStatus(latestSession.results as any[]);
  };

  const statusColors: Record<string, string> = {
    CLEAN: "bg-good/15 text-good",
    WATCH: "bg-warn/15 text-warn",
    FLAGS: "bg-bad/15 text-bad",
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-wide uppercase">
            CHAIN CHECK <span className="text-teal">COACH</span>
          </h1>
          <p className="text-xs text-muted-foreground tracking-wide">
            Coach Nick's Dashboard
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowAddClient(true)}
            className="font-display uppercase tracking-wider font-bold text-sm"
          >
            + Add Client
          </Button>
        </div>
      </header>

      <div className="container py-6 space-y-5">
        {/* Client List */}
        <div className="bg-card rounded-xl p-5 border border-border">
          <h3 className="font-display text-xl font-extrabold uppercase tracking-wide text-gold mb-4">
            All Clients
          </h3>

          {!clients || clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No clients yet. Add your first client above.</p>
          ) : (
            <div className="space-y-2">
              {clients.map((c) => {
                const status = getStatus(c.latestSession);
                const lastDate = c.latestSession ? new Date(c.latestSession.date).toLocaleDateString([], { month: "short", day: "numeric" }) : "No scans";

                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-xl p-4 border border-border hover:border-primary/50 transition-all"
                  >
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/coach/client/${c.id}`)}>
                      <div>
                        <div className="font-display text-lg font-bold tracking-wide">{c.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.program.toUpperCase()} · {lastDate}
                          {c.latestSession && ` · Wk ${c.latestSession.week}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {status !== "—" && (
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full font-display tracking-wider ${statusColors[status] || ""}`}>
                          {status}
                        </span>
                      )}
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="font-display text-xs uppercase tracking-wider"
                            onClick={() => setTriggerClientId(c.id)}
                          >
                            GHL
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle className="font-display uppercase tracking-wider">
                              Trigger GHL for {c.name}
                            </DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3 pt-2">
                            <Input
                              placeholder="Tag name (e.g., needs-review)"
                              value={ghlTag}
                              onChange={(e) => setGhlTag(e.target.value)}
                            />
                            <Button
                              onClick={() => triggerWebhook.mutate({ clientId: c.id, tag: ghlTag })}
                              disabled={triggerWebhook.isPending}
                              className="w-full font-display uppercase tracking-wider font-bold"
                            >
                              {triggerWebhook.isPending ? "Sending..." : "Apply Tag & Trigger"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="outline"
                        size="sm"
                        className="font-display text-xs uppercase tracking-wider"
                        onClick={() => navigate(`/coach/client/${c.id}`)}
                      >
                        View
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Client Dialog */}
      {showAddClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl p-6 border border-border w-full max-w-md">
            <h3 className="font-display text-xl font-extrabold uppercase tracking-wide text-gold mb-4">
              Add New Client
            </h3>
            <div className="space-y-3">
              <Input
                placeholder="Client name"
                value={newClient.name}
                onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
              />
              <Input
                type="email"
                placeholder="Client email"
                value={newClient.email}
                onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
              />
              <select
                value={newClient.program}
                onChange={(e) => setNewClient({ ...newClient, program: e.target.value as any })}
                className="w-full rounded-lg border border-border bg-background p-2.5 text-sm"
              >
                <option value="rebuild">Rebuild</option>
                <option value="restart">Restart</option>
                <option value="perform">Perform</option>
              </select>
              <Input
                type="date"
                value={newClient.startDate}
                onChange={(e) => setNewClient({ ...newClient, startDate: e.target.value })}
              />
              <div className="flex gap-3">
                <Button
                  onClick={() => createClient.mutate(newClient)}
                  disabled={!newClient.name || !newClient.email || createClient.isPending}
                  className="flex-1 font-display uppercase tracking-wider font-bold"
                >
                  {createClient.isPending ? "Adding..." : "Add Client"}
                </Button>
                <Button variant="outline" onClick={() => setShowAddClient(false)} className="font-display uppercase tracking-wider font-bold">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
