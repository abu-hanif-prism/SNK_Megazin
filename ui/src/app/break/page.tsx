import { Gate } from "@/steps/Gate";

export default function BreakPage() {
  return (
    <Gate
      title="We'll Be Back Soon!"
      lines={[
        "Thank you for using SnapNkeep to print your special memories! 📸",
        "We're currently taking a short break, but don't worry—we'll be back up and running shortly.",
        "Please check back soon, we appreciate your patience! 😊",
      ]}
    />
  );
}
