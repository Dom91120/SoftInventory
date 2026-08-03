"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await authClient.signOut();
    router.replace("/auth/login");
    router.refresh();
  }
  return (
    <button
      type="button"
      onClick={logout}
      title="Se déconnecter"
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sub text-muted transition hover:bg-danger-dim hover:text-danger"
    >
      <LogOut className="h-4 w-4" />
    </button>
  );
}
