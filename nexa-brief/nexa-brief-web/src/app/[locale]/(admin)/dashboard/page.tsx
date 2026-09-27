import { DashboardView } from "@/features/dashboard";
import { auth } from "../../../../../auth";

export default async function DashboardPage() {
  const session = await auth();
  const user = session?.user;
  return <DashboardView userName={user?.name ?? user?.email?.split("@")[0] ?? null} />;
}
