import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { getSessionUser } from "@/lib/auth";
import { getDemoUser } from "@/lib/queries";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sessionUser = await getSessionUser();

  let user = sessionUser
    ? { name: sessionUser.name, plan: sessionUser.plan, avatarUrl: sessionUser.avatarUrl }
    : null;

  if (!user) {
    const demo = await getDemoUser();
    if (demo) {
      user = { name: demo.name, plan: demo.plan, avatarUrl: demo.avatarUrl };
    }
  }

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar name={user.name} plan={user.plan} avatarUrl={user.avatarUrl} />
      <main className="min-w-0 flex-1">
        <Topbar />
        <div className="mx-auto max-w-[1180px] px-5 py-7 md:px-8">{children}</div>
      </main>
    </div>
  );
}
