import { Redirect } from "@/core/Redirect";

// unknown URL: same as the old wildcard route, back to the guest flow
export default function NotFound() {
  return <Redirect to="/" />;
}
