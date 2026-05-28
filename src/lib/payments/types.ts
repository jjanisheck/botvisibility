/**
 * x402 Payment Types - HTTP 402 Payment Required Standard
 *
 * This module implements typed interfaces for the x402 payment protocol
 * which enables machine-readable payment challenges via HTTP 402 responses.
 *
 * Designed to be wired to settlement providers (x402, Faremeter) without
 * hardcoding secrets or requiring unavailable credentials.
 *
 * @see https://www.x402.org/ - HTTP 402 Payment Protocol
 */

// ============================================================================
// Core x402 Types
// ============================================================================

/**
 * Supported payment networks for settlement
 */
export type PaymentNetwork =
  | 'ethereum'      // EVM mainnet
  | 'polygon'       // Polygon PoS
  | 'base'          // Coinbase L2
  | 'base-sepolia'  // Base testnet
  | 'solana'        // Solana mainnet (Faremeter primary)
  | 'arbitrum'      // Arbitrum One
  | 'optimism'      // OP Mainnet
  | 'testnet';      // Generic testnet for development

/**
 * Supported payment methods/tokens
 */
export type PaymentMethod =
  | 'USDC'
  | 'USDT'
  | 'ETH'
  | 'SOL'
  | 'DAI'
  | 'native';       // Chain's native token

/**
 * Payment status for tracking
 */
export type PaymentStatus =
  | 'pending'       // Awaiting payment
  | 'processing'    // Payment submitted, confirming
  | 'confirmed'     // Payment confirmed on-chain
  | 'failed'        // Payment failed or rejected
  | 'expired';      // Payment window expired

// ============================================================================
// x402 Challenge/Response Types
// ============================================================================

/**
 * Represents a single accepted payment option
 * Part of the WWW-Authenticate header in 402 responses
 */
export interface PaymentOption {
  /** Payment network/chain */
  network: PaymentNetwork;
  /** Token/method for payment */
  method: PaymentMethod;
  /** Amount in smallest unit (e.g., wei, lamports, cents) */
  amount: string;
  /** Human-readable amount for display */
  displayAmount: string;
  /** Recipient address for payment */
  recipient: string;
  /** Optional: Contract address for ERC-20/SPL tokens */
  tokenContract?: string;
  /** Optional: Minimum confirmations required */
  minConfirmations?: number;
}

/**
 * x402 Payment Challenge
 * Returned in HTTP 402 response body per x402 spec
 */
export interface X402PaymentChallenge {
  /** Protocol version */
  version: '1.0';
  /** Unique payment request ID */
  paymentId: string;
  /** Resource being requested */
  resource: string;
  /** Human-readable description */
  description: string;
  /** Available payment options (at least one required) */
  paymentOptions: PaymentOption[];
  /** Unix timestamp when payment expires */
  expiresAt: number;
  /** Optional: Callback URL for async payment notification */
  callbackUrl?: string;
  /** Optional: Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Payment proof submitted by client
 * Sent in X-Payment-Proof header or request body
 */
export interface X402PaymentProof {
  /** Original payment request ID */
  paymentId: string;
  /** Network where payment was made */
  network: PaymentNetwork;
  /** Transaction hash/signature */
  transactionHash: string;
  /** Sender address */
  sender: string;
  /** Optional: Block number for EVM chains */
  blockNumber?: number;
  /** Optional: Signature proving ownership of sender */
  signature?: string;
  /** Optional: Raw x402 PaymentPayload (base64) from X-PAYMENT header for facilitator verification */
  rawX402Payload?: string;
}

/**
 * Result of verifying a payment proof
 */
export interface PaymentVerificationResult {
  /** Whether payment is valid */
  valid: boolean;
  /** Payment status */
  status: PaymentStatus;
  /** If invalid, reason for failure */
  reason?: string;
  /** Number of confirmations (if applicable) */
  confirmations?: number;
  /** Verified amount in smallest unit */
  verifiedAmount?: string;
  /** When verification occurred */
  verifiedAt?: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Payment tier configuration for BotVisibility scans
 */
export interface ScanPricingTier {
  /** Tier identifier */
  id: string;
  /** Display name */
  name: string;
  /** What's included */
  description: string;
  /** Features included in this tier */
  features: string[];
  /** Price in USD cents (100 = $1.00) */
  priceUsdCents: number;
  /** Is this tier enabled */
  enabled: boolean;
}

/**
 * Payment provider configuration
 * Loaded from environment, never hardcoded
 */
export interface PaymentProviderConfig {
  /** Provider identifier */
  provider: 'x402' | 'faremeter' | 'mock';
  /** Whether payments are enabled */
  enabled: boolean;
  /** API endpoint (from env) */
  apiEndpoint?: string;
  /** Webhook secret for callbacks (from env) */
  webhookSecret?: string;
  /** Networks enabled for this provider */
  networks: PaymentNetwork[];
  /** Default payment method */
  defaultMethod: PaymentMethod;
  /** Recipient address (from env) */
  recipientAddress?: string;
  /** Payment expiry in seconds */
  expirySeconds: number;
}

/**
 * Full payment configuration
 */
export interface PaymentConfig {
  /** Whether paid features are enabled */
  paymentsEnabled: boolean;
  /** Active payment provider */
  provider: PaymentProviderConfig;
  /** Available pricing tiers */
  tiers: ScanPricingTier[];
  /** Minimum payment amount in USD cents */
  minimumAmountCents: number;
  /** Whether to require payment proof validation */
  requireProofValidation: boolean;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Standard 402 error response body
 */
export interface PaymentRequiredResponse {
  /** Error type identifier */
  error: 'payment_required';
  /** Human-readable message */
  message: string;
  /** x402 payment challenge */
  challenge: X402PaymentChallenge;
  /** Link to documentation */
  docsUrl?: string;
}

/**
 * Successful payment acknowledgment
 */
export interface PaymentAcceptedResponse {
  /** Success indicator */
  success: true;
  /** Payment ID that was fulfilled */
  paymentId: string;
  /** Access token for the paid resource (if applicable) */
  accessToken?: string;
  /** Expiry of the access */
  expiresAt?: string;
}

// ============================================================================
// Faremeter Integration Types (Solana-focused)
// ============================================================================

/**
 * Faremeter-specific payment options
 * Extends base for Solana ecosystem
 */
export interface FaremeterPaymentOption extends PaymentOption {
  network: 'solana';
  /** Solana program ID for payment */
  programId?: string;
  /** SPL token mint address */
  tokenMint?: string;
  /** Priority fee level */
  priorityFee?: 'low' | 'medium' | 'high';
}

/**
 * Faremeter transaction details
 */
export interface FaremeterTransaction {
  /** Solana transaction signature */
  signature: string;
  /** Slot where transaction was confirmed */
  slot: number;
  /** Block time */
  blockTime: number;
  /** Fee paid in lamports */
  fee: number;
  /** Confirmation status */
  confirmationStatus: 'processed' | 'confirmed' | 'finalized';
}

// ============================================================================
// Type Guards
// ============================================================================

export function isPaymentProof(obj: unknown): obj is X402PaymentProof {
  if (!obj || typeof obj !== 'object') return false;
  const p = obj as Record<string, unknown>;
  return (
    typeof p.paymentId === 'string' &&
    typeof p.network === 'string' &&
    typeof p.transactionHash === 'string' &&
    typeof p.sender === 'string'
  );
}

export function isValidPaymentNetwork(network: string): network is PaymentNetwork {
  return ['ethereum', 'polygon', 'base', 'base-sepolia', 'solana', 'arbitrum', 'optimism', 'testnet'].includes(network);
}

export function isValidPaymentMethod(method: string): method is PaymentMethod {
  return ['USDC', 'USDT', 'ETH', 'SOL', 'DAI', 'native'].includes(method);
}
