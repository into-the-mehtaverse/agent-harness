import { RuntimeProvider } from "@/providers/RuntimeProvider";
import { Thread } from "@/components/assistant-ui/thread";

export function ChatPage() {
  return (
    <RuntimeProvider>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Thread />
      </div>
    </RuntimeProvider>
  );
}
