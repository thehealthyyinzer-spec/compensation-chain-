import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { computeScanStatus } from "@/lib/scanUtils";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

function ClientRow({ c, getStatus, statusColors, navigate, ghlTag, setGhlTag, setTriggerClientId, triggerWebhook, sendMagicLink }: any) {
  const status = getStatus(c.latestSession);
  const lastDate = c.latestSession ? new Date(c.latestSession.date).toLocaleDateString([], { month: "short", day: "numeric" }) : "No scans";
  return (
    <div className="flex items-center justify-between rounded-xl p-4 border border-border hover:border-primary/50 transition-all">
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/coach/client/${c.id}`)}>        <div>
          <div className="font-display text-lg font-bold tracking-wide">{c.name}</div>
          <div className="text-xs text-muted-foreground">
            {c.program.toUpperCase()} · {lastDate}
            {c.latestSession && ` · Wk ${c.latestSession.week}`}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap justify-end">
        {status !== "—" && (
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full font-display tracking-wider ${statusColors[status] || ""}`}>
            {status}
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          className="font-display text-xs uppercase tracking-wider"
          disabled={sendMagicLink?.isPending}
          onClick={() => sendMagicLink?.mutate({ email: c.email, origin: window.location.origin })}
        >
          {sendMagicLink?.isPending ? "…" : "Send Link"}
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="font-display text-xs uppercase tracking-wider" onClick={() => setTriggerClientId(c.id)}>
              GHL
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display uppercase tracking-wider">Trigger GHL for {c.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <Input placeholder="Tag name (e.g., needs-review)" value={ghlTag} onChange={(e: any) => setGhlTag(e.target.value)} />
              <Button onClick={() => triggerWebhook.mutate({ clientId: c.id, tag: ghlTag })} disabled={triggerWebhook.isPending} className="w-full font-display uppercase tracking-wider font-bold">
                {triggerWebhook.isPending ? "Sending..." : "Apply Tag & Trigger"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Button variant="outline" size="sm" className="font-display text-xs uppercase tracking-wider" onClick={() => navigate(`/coach/client/${c.id}`)}>View</Button>
      </div>
    </div>
  );
}

export default function CoachDashboard() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => navigate("/login"),
  });

  // Redirect non-admins in useEffect to avoid setState-during-render warning
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || user?.role !== "admin")) {
      navigate("/login");
    }
  }, [authLoading, isAuthenticated, user, navigate]);

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

  // Free scan leads
  const { data: freeScanLeads } = trpc.admin.freeScanLeads.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
  });
  const [showLeads, setShowLeads] = useState(false);

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

  // Magic link sender
  const sendMagicLink = trpc.magicLink.sendToClient.useMutation({
    onSuccess: (data) => {
      // Copy as backup and show confirmation
      navigator.clipboard?.writeText(data.loginUrl).catch(() => {});
      toast.success("Login link sent via email.", {
        description: "Also copied to clipboard as backup.",
        duration: 6000,
      });
    },
    onError: () => toast.error("Failed to send link."),
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "admin") {
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

  // Priority queue categorization
  const now = Date.now();
  const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;
  const TEN_DAYS = 10 * 24 * 60 * 60 * 1000;

  const categorized = {
    attention: [] as typeof clients,
    due: [] as typeof clients,
    good: [] as typeof clients,
  };

  clients?.forEach((c) => {
    const lastScan = c.latestSession ? new Date(c.latestSession.date).getTime() : 0;
    const status = c.latestSession ? computeScanStatus(c.latestSession.results as any[]) : null;
    const daysSinceScan = lastScan ? (now - lastScan) / (24 * 60 * 60 * 1000) : 999;
    const isDue = daysSinceScan >= 14;
    const isInactive = daysSinceScan >= 10;
    const hasFlags = status === "FLAGS";

    if (hasFlags || (isInactive && !c.latestSession)) categorized.attention!.push(c);
    else if (isDue) categorized.due!.push(c);
    else categorized.good!.push(c);
  });

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
          <button
            onClick={() => logout.mutate()}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-transparent hover:border-border"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="container py-6 space-y-5">
        {/* Priority Queue */}
        {!clients || clients.length === 0 ? (
          <div className="bg-card rounded-xl p-5 border border-border">
            <p className="text-sm text-muted-foreground">No clients yet. Add your first client above.</p>
          </div>
        ) : (
          <>
            {/* Needs Attention */}
            {(categorized.attention?.length ?? 0) > 0 && (
              <div className="bg-card rounded-xl p-5 border border-orange/40">
                <h3 className="font-display text-base font-extrabold uppercase tracking-wider text-orange mb-3">
                  Needs Attention
                </h3>
                <div className="space-y-2">
                  {categorized.attention?.map((c) => <ClientRow key={c.id} c={c} getStatus={getStatus} statusColors={statusColors} navigate={navigate} ghlTag={ghlTag} setGhlTag={setGhlTag} setTriggerClientId={setTriggerClientId} triggerWebhook={triggerWebhook} sendMagicLink={sendMagicLink} />)}
                </div>
              </div>
            )}

            {/* Scan Due */}
            {(categorized.due?.length ?? 0) > 0 && (
              <div className="bg-card rounded-xl p-5 border border-primary/40">
                <h3 className="font-display text-base font-extrabold uppercase tracking-wider text-primary mb-3">
                  Scan Due
                </h3>
                <div className="space-y-2">
                  {categorized.due?.map((c) => <ClientRow key={c.id} c={c} getStatus={getStatus} statusColors={statusColors} navigate={navigate} ghlTag={ghlTag} setGhlTag={setGhlTag} setTriggerClientId={setTriggerClientId} triggerWebhook={triggerWebhook} sendMagicLink={sendMagicLink} />)}
                </div>
              </div>
            )}

            {/* On Track */}
            {(categorized.good?.length ?? 0) > 0 && (
              <div className="bg-card rounded-xl p-5 border border-border">
                <h3 className="font-display text-base font-extrabold uppercase tracking-wider text-gold mb-3">
                  On Track
                </h3>
                <div className="space-y-2">
                  {categorized.good?.map((c) => <ClientRow key={c.id} c={c} getStatus={getStatus} statusColors={statusColors} navigate={navigate} ghlTag={ghlTag} setGhlTag={setGhlTag} setTriggerClientId={setTriggerClientId} triggerWebhook={triggerWebhook} sendMagicLink={sendMagicLink} />)}
                </div>
              </div>
            )}
          </>
        )}
        {/* Free Scan Leads */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <button
            onClick={() => setShowLeads((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/30 transition-colors"
          >
            <div>
              <div className="font-display text-base font-extrabold uppercase tracking-wider text-primary">
                Free Scan Leads
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {freeScanLeads?.length ?? 0} submission{(freeScanLeads?.length ?? 0) !== 1 ? "s" : ""} via /free-scan
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className={`text-muted-foreground transition-transform duration-200 ${showLeads ? "rotate-180" : ""}`}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showLeads && (
            <div className="border-t border-border">
              {!freeScanLeads || freeScanLeads.length === 0 ? (
                <div className="px-5 py-4 text-sm text-muted-foreground">No free scan submissions yet.</div>
              ) : (
                <div className="divide-y divide-border">
                  {freeScanLeads.map((lead: any) => (
                    <div key={lead.id} className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <div className="font-semibold text-sm">{lead.firstName}</div>
                        <div className="text-xs text-muted-foreground">{lead.email}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full font-display tracking-wider ${
                          lead.quizResult === "rebuild" ? "bg-orange/15 text-orange" : "bg-primary/15 text-primary"
                        }`}>
                          {lead.quizResult?.toUpperCase()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(lead.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
