"use client";

// Step host: loads the session, applies entry gates, renders the current
// step. The flow itself is just FLOW_STEPS in flow-state.tsx.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/core/api";
import { useToast } from "@/core/toast";
import { useFlow } from "./flow-state";
import { WelcomeStep } from "@/steps/WelcomeStep";
import { EditorStep } from "@/steps/EditorStep";
import { ConfirmStep } from "@/steps/ConfirmStep";
import { PrintingStep } from "@/steps/PrintingStep";

export function PrintFlow() {
  const { step, setSession } = useFlow();
  const router = useRouter();
  const { show } = useToast();

  useEffect(() => {
    getSession()
      .then((session) => {
        setSession(session);
        if (session.breakMode) router.push("/break");
      })
      .catch(() => show("error", "Could not reach the print station. Please try again in a moment."));
  }, [setSession, router, show]);

  switch (step) {
    case "welcome":
      return <WelcomeStep />;
    case "editor":
      return <EditorStep />;
    case "confirm":
      return <ConfirmStep />;
    case "printing":
      return <PrintingStep />;
  }
}
