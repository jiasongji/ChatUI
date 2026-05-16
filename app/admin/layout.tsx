import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AdminLayout } from "./AdminLayout";

export const dynamic = "force-dynamic";

export default async function AdminRootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user || user.status === "disabled") {
    redirect("/login");
  }
  if (user.role !== "admin") {
    redirect("/chat");
  }

  return (
    <AdminLayout username={user.username}>
      {children}
    </AdminLayout>
  );
}
