import { RuntimeProvider } from "@/providers/RuntimeProvider";
import { Thread } from "@/components/assistant-ui/thread";

export function ChatPage() {
  return (
    <RuntimeProvider>
      <Thread />
    </RuntimeProvider>
  );
}
