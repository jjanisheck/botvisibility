/**
 * Payment Module - Public API
 *
 * Exports all payment-related types and utilities for
 * implementing HTTP 402 payment flows.
 */

// Types
export type {
  PaymentNetwork,
  PaymentMethod,
  PaymentStatus,
  PaymentOption,
  X402PaymentChallenge,
  X402PaymentProof,
  PaymentVerificationResult,
  ScanPricingTier,
  PaymentProviderConfig,
  PaymentConfig,
  PaymentRequiredResponse,
  PaymentAcceptedResponse,
  FaremeterPaymentOption,
  FaremeterTransaction,
} from './types';

// Type guards
export {
  isPaymentProof,
  isValidPaymentNetwork,
  isValidPaymentMethod,
} from './types';

// Configuration
export {
  loadPaymentConfig,
  getPricingTier,
  getEnabledTiers,
  isTierFree,
  isPaymentSystemReady,
  getMockPaymentConfig,
  DEFAULT_PRICING_TIERS,
} from './config';

// Challenge & Response Helpers
export {
  createPaymentChallenge,
  createPaymentRequiredResponse,
  extractPaymentProof,
  verifyPaymentProof,
  hasPaymentProof,
  quickPaymentRequired,
} from './challenge';
