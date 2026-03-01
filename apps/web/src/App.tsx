import { ErrorBoundary } from "@/ErrorBoundary";
import { ChatPage } from "@/pages/ChatPage";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function App() {
  return (
    <TooltipProvider>
      <div className="flex min-h-screen flex-col bg-background">
        <header className="shrink-0 border-b border-border bg-background px-4 py-3">
          <h1 className="text-lg font-semibold text-foreground">
            Agent Harness — Chat
          </h1>
        </header>

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/30">
          <ErrorBoundary>
            <ChatPage />
          </ErrorBoundary>
        </main>
      </div>
    </TooltipProvider>
  );
}
