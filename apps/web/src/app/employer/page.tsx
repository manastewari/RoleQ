"use client";

import { EmployerApp } from "@/components/EmployerApp";
import { useRoleGuard } from "@/lib/auth";

export default function EmployerPage() {
  const { user, loading } = useRoleGuard("employer");
  if (loading || !user) {
    return <div className="grid min-h-screen place-items-center text-sm font-semibold text-muted">Opening your employer workspace…</div>;
  }
  return <EmployerApp />;
}
