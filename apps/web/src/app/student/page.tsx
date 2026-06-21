"use client";

import { StudentApp } from "@/components/StudentApp";
import { useRoleGuard } from "@/lib/auth";

export default function StudentPage() {
  const { user, loading } = useRoleGuard("student");
  if (loading || !user) {
    return <div className="grid min-h-screen place-items-center text-sm font-semibold text-muted">Opening your student workspace…</div>;
  }
  return <StudentApp />;
}
