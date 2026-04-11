import { cookies } from "next/headers";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

export const metadata = {
  title: "Admin | BondCheck",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get("bcp_admin_auth");
  const isAuthenticated = authCookie?.value === "authenticated";

  if (!isAuthenticated) {
    return <AdminLoginForm />;
  }

  return (
    <div className="fixed inset-0 flex z-50 bg-[#f1f5f9]">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
