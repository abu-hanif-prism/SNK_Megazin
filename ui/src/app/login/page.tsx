import { Redirect } from "@/core/Redirect";

// legacy URL kept so old QR codes / bookmarks still land somewhere sensible
export default function LegacyRedirect() {
  return <Redirect to="/admin/login/" />;
}
