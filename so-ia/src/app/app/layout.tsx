import { AppShell } from "@/components/layout/app-shell";
import { OrgGuard } from "@/components/providers/org-guard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <OrgGuard>
      <AppShell>{children}</AppShell>
    </OrgGuard>
  );
}
