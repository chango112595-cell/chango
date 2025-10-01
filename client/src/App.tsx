import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SpeechCoordinationProvider } from "@/lib/speechCoordination";
import { ConversationProvider } from "@/lib/conversationContext";
import Dashboard from "@/pages/dashboard";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SpeechCoordinationProvider>
        <ConversationProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ConversationProvider>
      </SpeechCoordinationProvider>
    </QueryClientProvider>
  );
}

export default App;
