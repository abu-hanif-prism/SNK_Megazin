"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Static export can't do server redirects, so legacy URLs (old QR codes,
// bookmarks) hop to their new home on the client.
export function Redirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(to);
  }, [router, to]);
  return null;
}
