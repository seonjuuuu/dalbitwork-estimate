import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { EstimateProvider } from "./contexts/EstimateContext";
import { DesktopNotificationProvider } from "./contexts/DesktopNotificationContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import DocumentList from "./pages/DocumentList";
import DocumentEdit from "./pages/DocumentEdit";
import NoteTemplates from "./pages/NoteTemplates";
import MonthlySales from "./pages/MonthlySales";
import ServiceItems from "./pages/ServiceItems";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import HKTBInvoice from "./pages/HKTBInvoice";
import HKTBRetainerInvoice from "./pages/HKTBRetainerInvoice";
import Expenses from "./pages/Expenses";
import CalendarPage from "./pages/CalendarPage";
import KanbanPage from "./pages/KanbanPage";
import MyPdfFiles from "./pages/MyPdfFiles";
import Sidebar from "./components/Sidebar";
import GlobalSearch from "./components/GlobalSearch";
import { useAuth } from "@/_core/hooks/useAuth";
import LoginPage from "./pages/LoginPage";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/editor" component={Home} />
      <Route path="/proposals">
        <DocumentList key="proposal" type="proposal" />
      </Route>
      <Route path="/proposals/:id">
        {(params) => <DocumentEdit key={params.id} id={params.id} type="proposal" />}
      </Route>
      <Route path="/estimates">
        <DocumentList key="estimate" type="estimate" />
      </Route>
      <Route path="/estimates/:id">
        {(params) => <DocumentEdit key={params.id} id={params.id} type="estimate" />}
      </Route>
      <Route path="/templates" component={NoteTemplates} />
      <Route path="/services" component={ServiceItems} />
      <Route path="/clients" component={Clients} />
      <Route path="/clients/:id">
        {(params) => <ClientDetail id={params.id} />}
      </Route>
      <Route path="/kanban" component={KanbanPage} />
      <Route path="/my-pdfs" component={MyPdfFiles} />
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/sales" component={MonthlySales} />
      <Route path="/hktb-invoice" component={HKTBInvoice} />
      <Route path="/hktb-retainer" component={HKTBRetainerInvoice} />
      <Route path="/expenses" component={Expenses} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

// 알림을 눌러 앱을 열거나(또는 다시 포그라운드로 돌아오면) 기기 아이콘의 알림 숫자 뱃지를 지워준다
function useClearAppBadge() {
  useEffect(() => {
    const clear = () => {
      if ("clearAppBadge" in navigator) {
        (navigator as Navigator & { clearAppBadge: () => Promise<void> }).clearAppBadge().catch(() => {});
      }
    };
    clear();
    const onVisible = () => {
      if (document.visibilityState === "visible") clear();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
}

function App() {
  useClearAppBadge();

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <AuthGate>
            <DesktopNotificationProvider>
              <EstimateProvider>
                <div className="flex h-screen overflow-hidden">
                  <Sidebar />
                  <main className="flex-1 min-w-0 overflow-y-auto overflow-x-auto h-full">
                    <Router />
                  </main>
                  <GlobalSearch />
                </div>
              </EstimateProvider>
            </DesktopNotificationProvider>
          </AuthGate>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
