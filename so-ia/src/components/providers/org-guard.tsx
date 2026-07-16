"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@/components/providers/organization-provider";

export function OrgGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const organization = useOrganization();

  useEffect(() => {
    if (organization.hydrated && organization.status !== "ready") {
      router.replace("/onboarding/tipo");
    }
  }, [organization.hydrated, organization.status, router]);

  if (!organization.hydrated || organization.status !== "ready") {
    return null;
  }

  return <>{children}</>;
}
