"use client";

import { CopilotKit } from "@copilotkit/react-core";
import { CopilotPopup } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";

export default function ChatWidget() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" agent="supportAgent">
      <CopilotPopup
        labels={{
          title: "ShopEasy Support",
          initial: "Hi! 👋 I'm Sarah from ShopEasy support. How can I help you today?",
        }}
      />
    </CopilotKit>
  );
}