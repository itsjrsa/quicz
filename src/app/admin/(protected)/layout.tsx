import Link from "next/link";
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
    <div className="min-h-screen bg-surface">
      <header className="border-b border-line px-6 py-3 flex items-center justify-between bg-surface">
        <Link
          href="/admin/quizzes"
          className="group flex items-baseline gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 rounded px-1"
        >
          <span className="font-bold text-lg tracking-tight">Quicz</span>
          <span className="text-[10px] font-mono font-semibold group-hover:font-bold uppercase tracking-[0.25em] text-ink-muted group-hover:text-ink transition-colors">
            Admin
          </span>
        </Link>
        <LogoutButton />
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
