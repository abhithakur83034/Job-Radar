import { MobileNav, Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { getSessionUser } from "@/lib/auth";
import { getDemoUser } from "@/lib/queries";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sessionUser = await getSessionUser();

  let user = sessionUser
    ? {
        name: sessionUser.name,
        plan: sessionUser.plan || "free",
        avatarUrl: sessionUser.avatarUrl,
        role: sessionUser.role,
        unreadNotifications: sessionUser.unreadNotifications,
      }
    : null;

  if (!user) {
    const demo = await getDemoUser();
    if (demo) {
      user = { name: demo.name, plan: demo.plan || "free", avatarUrl: demo.avatarUrl, role: demo.role, unreadNotifications: 0 };
    }
  }

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar name={user.name} plan={user.plan} avatarUrl={user.avatarUrl} />
      {/* Bottom padding keeps content clear of the mobile tab bar */}
      <main className="min-w-0 flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <Topbar isAdmin={user.role === "admin"} unreadNotifications={user.unreadNotifications ?? 0} />
        <div className="mx-auto max-w-[1180px] px-4 py-5 sm:px-5 md:px-8 md:py-7">{children}</div>
      </main>
      <MobileNav />
    </div>
  );
}
