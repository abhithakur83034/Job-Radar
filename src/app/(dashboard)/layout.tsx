import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { getDemoUser } from "@/lib/queries";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getDemoUser();

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
