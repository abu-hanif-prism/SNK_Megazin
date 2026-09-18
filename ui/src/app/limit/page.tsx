import { Gate } from "@/steps/Gate";

export default function LimitPage() {
  return (
    <Gate
      title="Print Limit Reached"
      lines={[
        "Thank you for using SnapNkeep to print your special memories! 📸",
        "It looks like you've reached the maximum number of prints available for now.",
        "We appreciate your understanding and hope you enjoy the rest of the event!",
      ]}
    />
  );
}
