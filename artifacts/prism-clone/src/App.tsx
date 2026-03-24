import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "./components/layout";
import Dashboard from "./pages/dashboard";
import Bills from "./pages/bills";
import Calendar from "./pages/calendar";
import Billers from "./pages/billers";
import Income from "./pages/income";
import Accounts from "./pages/accounts";
import Analytics from "./pages/analytics";
import Security from "./pages/security";
import Budget from "./pages/budget";
import GmailImport from "./pages/gmail-import";
import NotFound from "./pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/bills" component={Bills} />
      <Route path="/calendar" component={Calendar} />
      <Route path="/billers" component={Billers} />
      <Route path="/income" component={Income} />
      <Route path="/accounts" component={Accounts} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/security" component={Security} />
      <Route path="/budget" component={Budget} />
      <Route path="/gmail-import" component={GmailImport} />
      <Route component={NotFound} />
    </Switch>
  );
}

/**
 * Determine the Wouter router base.
 * VITE_ROUTER_BASE is the browser-visible path prefix (e.g. "/prism-clone")
 * which may differ from import.meta.env.BASE_URL when the Replit proxy strips
 * the prefix before forwarding requests to the Vite dev server.
 */
const ROUTER_BASE = (import.meta.env.VITE_ROUTER_BASE as string | undefined)
  ?? import.meta.env.BASE_URL?.replace(/\/$/, "")
  ?? "";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={ROUTER_BASE}>
          <Layout>
            <Router />
          </Layout>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
