import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import MagicLinkVerify from "./pages/MagicLinkVerify";
import ClientDashboard from "./pages/ClientDashboard";
import ScanPage from "./pages/ScanPage";
import ScanResults from "./pages/ScanResults";
import SessionHistory from "./pages/SessionHistory";
import CoachDashboard from "./pages/CoachDashboard";
import CoachClientView from "./pages/CoachClientView";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/verify" component={MagicLinkVerify} />
      <Route path="/dashboard" component={ClientDashboard} />
      <Route path="/scan" component={ScanPage} />
      <Route path="/results/:sessionId" component={ScanResults} />
      <Route path="/history" component={SessionHistory} />
      <Route path="/coach" component={CoachDashboard} />
      <Route path="/coach/client/:clientId" component={CoachClientView} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
