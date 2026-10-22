import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AdminNav } from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

/**
 * Admin area shell. Non-admins get a 404 (the portal isn't advertised); every admin
 * API is also authorized on the backend, so this check is for UX, not security.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") notFound();

  return (
    <div className="min-h-screen md:flex">
      <AdminNav name={user.name} username={user.username} />
      <main className="min-w-0 flex-1 px-4 py-5 sm:px-5 md:px-8 md:py-7">
        <div className="mx-auto max-w-[1180px]">{children}</div>
      </main>
    </div>
  );
}
