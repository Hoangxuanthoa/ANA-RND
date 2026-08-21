import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function DashboardPage() {
  const session = await getCurrentUser();
  if (!session) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-gray-500">Signed in as {session.email} ({session.role})</p>
    </main>
  );
}
