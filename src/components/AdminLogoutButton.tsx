"use client";

import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminLogoutButton() {
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);

  async function logout() {
    setIsBusy(true);
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <Button variant="danger-soft" isDisabled={isBusy} onPress={logout}>
      {isBusy ? "Signing out..." : "Logout"}
    </Button>
  );
}
