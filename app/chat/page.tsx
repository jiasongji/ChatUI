import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ChatClient } from "./ChatClient";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const user = await getCurrentUser();
  if (!user || user.status === "disabled") {
    redirect("/login");
  }

  return (
    <ChatClient
      user={{
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        status: user.status
      }}
    />
  );
}
