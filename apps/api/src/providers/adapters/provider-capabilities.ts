/**
 * Capability flag type.
 * Phase 1 keeps a simple boolean; no experimental / unknown tri-state.
 */
export type ProviderCapabilityState = boolean;

export interface ProviderCapabilities {
  allocateNumber: ProviderCapabilityState;
  pollMessages: ProviderCapabilityState;
  webhook: ProviderCapabilityState;
  cancelOrder: ProviderCapabilityState;
  releaseNumber: ProviderCapabilityState;
  queryBalance: ProviderCapabilityState;
}

/** Returns a fresh all-false capabilities object (never a shared mutable singleton). */
export function createUnsupportedProviderCapabilities(): ProviderCapabilities {
  return {
    allocateNumber: false,
    pollMessages: false,
    webhook: false,
    cancelOrder: false,
    releaseNumber: false,
    queryBalance: false,
  };
}
