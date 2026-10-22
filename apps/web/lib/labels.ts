export function activityKindLabel(kind: string): string {
  switch (kind) {
    case "agent.created":
      return "Agent registered";
    case "policy.published":
      return "Policy published";
    case "intent.approved":
      return "Intent approved";
    case "evidence.attached":
      return "Evidence attached";
    default:
      return "Workspace activity";
  }
}

export function evidenceKindLabel(kind: string): string {
  return kind === "user_operation" ? "UserOperation" : "Transaction";
}

export function anchorKindLabel(kind: string): string {
  switch (kind) {
    case "policy":
      return "Policy";
    case "intent":
      return "Intent";
    case "report":
      return "Report";
    case "evidence":
      return "Evidence";
    default:
      return "Unknown";
  }
}
