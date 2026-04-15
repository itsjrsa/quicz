import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import LogoutButton from "@/components/admin/LogoutButton";

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
      <header className="border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <a href="/admin/quizzes" className="font-semibold text-lg hover:text-gray-700">
          Quicz Admin
        </a>
        <LogoutButton />
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
