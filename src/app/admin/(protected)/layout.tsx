import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authenticated = await isAdminAuthenticated();
  if (!authenticated) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-3">
        <span className="font-semibold text-lg">Quicz Admin</span>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
