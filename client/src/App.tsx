import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { EstimateProvider } from "./contexts/EstimateContext";
import Home from "./pages/Home";
import DocumentList from "./pages/DocumentList";
import Sidebar from "./components/Sidebar";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/proposals">
        <DocumentList type="proposal" />
      </Route>
      <Route path="/estimates">
        <DocumentList type="estimate" />
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <EstimateProvider>
          <TooltipProvider>
            <Toaster />
            <div className="flex h-screen overflow-hidden">
              <Sidebar />
              <main className="flex-1 overflow-y-auto">
                <Router />
              </main>
            </div>
          </TooltipProvider>
        </EstimateProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
