"use client";

export const SESSION_EXPIRED_EVENT = "shl:session-expired";

// Fetch helpers cannot call router hooks. Let the workspace's single router
// listener clear identity and navigate; permission denials never call this.
export function expireWorkspaceSession(): void {
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}
