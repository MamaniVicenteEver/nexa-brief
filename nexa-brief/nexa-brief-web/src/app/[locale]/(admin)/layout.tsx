import { JobsTray } from "@/features/create-video/components/JobsTray";
import { redirect } from "@/i18n/navigation";
import { AdminHeader } from "@/shared/components/layout/AdminHeader";
import { AdminRouteContent } from "@/shared/components/layout/AdminRouteContent";
import { auth } from "../../../../auth";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect({ href: "/login", locale });
  }

  return (
    <>
      <div className="nb-grain" />
      <AdminHeader />
      <AdminRouteContent>{children}</AdminRouteContent>
      <JobsTray />
    </>
  );
}
