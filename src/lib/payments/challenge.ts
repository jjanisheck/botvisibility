/**
 * x402 Payment Challenge Generator
 *
 * Creates properly formatted HTTP 402 payment challenges
 * following the x402 specification.
 */

import { NextResponse } from 'next/server';
import {
  X402PaymentChallenge,
  X402PaymentProof,
  PaymentOption,
  PaymentRequiredResponse,
  PaymentVerificationResult,
  PaymentNetwork,
} from './types';
import { loadPaymentConfig, getPricingTier } from './config';

// Base Sepolia RPC for testnet verification
const BASE_SEPOLIA_RPC = 'https://sepolia.base.org';

// Base mainnet RPC for on-chain verification
const BASE_MAINNET_RPC = 'https://mainnet.base.org';

// Coinbase x402 facilitator endpoint
const X402_FACILITATOR_URL = 'https://x402.org/facilitator';

// USDC contract address on Base mainnet (6 decimals)
const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// ============================================================================
// Challenge Generation
// ============================================================================

/**
 * Generate a unique payment ID
 */
function generatePaymentId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `pay_${timestamp}_${random}`;
}

/**
 * Convert USD cents to token amount
 * In production, this would use real exchange rates
 */
function usdCentsToTokenAmount(
  cents: number,
  method: string,
  network: PaymentNetwork
): { amount: string; displayAmount: string } {
  // For now, assume 1:1 for stablecoins (USDC, USDT, DAI)
  // This would be replaced with real price feeds in production
  const stablecoins = ['USDC', 'USDT', 'DAI'];

  if (stablecoins.includes(method)) {
    // Stablecoins use 6 decimals (USDC, USDT) or 18 (DAI)
    const decimals = method === 'DAI' ? 18 : 6;
    const baseAmount = cents / 100;
    const amount = BigInt(Math.round(baseAmount * Math.pow(10, decimals))).toString();
    return {
      amount,
      displayAmount: `$${baseAmount.toFixed(2)} ${method}`,
    };
  }

  // For native tokens, would need price feed
  // Return placeholder that would be replaced with real conversion
  return {
    amount: cents.toString(), // Placeholder
    displayAmount: `~$${(cents / 100).toFixed(2)} in ${method} on ${network}`,
  };
}

/**
 * Build payment options for a given price
 */
function buildPaymentOptions(priceUsdCents: number): PaymentOption[] {
  const config = loadPaymentConfig();
  const { provider } = config;

  if (!provider.recipientAddress) {
    // Return empty if no recipient configured
    return [];
  }

  const options: PaymentOption[] = [];

  for (const network of provider.networks) {
    const { amount, displayAmount } = usdCentsToTokenAmount(
      priceUsdCents,
      provider.defaultMethod,
      network
    );

    options.push({
      network,
      method: provider.defaultMethod,
      amount,
      displayAmount,
      recipient: provider.recipientAddress,
      minConfirmations: network === 'solana' ? 1 : 3,
    });
  }

  return options;
}

/**
 * Create an x402 payment challenge for a resource
 */
export function createPaymentChallenge(
  resource: string,
  tierId: string,
  callbackUrl?: string
): X402PaymentChallenge | null {
  const tier = getPricingTier(tierId);
  if (!tier || tier.priceUsdCents === 0) {
    return null; // No payment needed for free tier
  }

  const config = loadPaymentConfig();
  const paymentOptions = buildPaymentOptions(tier.priceUsdCents);

  if (paymentOptions.length === 0) {
    // Payment system not configured
    return null;
  }

  return {
    version: '1.0',
    paymentId: generatePaymentId(),
    resource,
    description: `${tier.name}: ${tier.description}`,
    paymentOptions,
    expiresAt: Math.floor(Date.now() / 1000) + config.provider.expirySeconds,
    callbackUrl,
    metadata: {
      tierId,
      tierName: tier.name,
      features: tier.features,
    },
  };
}

// ============================================================================
// HTTP 402 Response Helpers
// ============================================================================

/**
 * Create HTTP 402 Payment Required response
 * Follows x402 specification for headers and body format
 */
export function createPaymentRequiredResponse(
  challenge: X402PaymentChallenge
): NextResponse<PaymentRequiredResponse> {
  const body: PaymentRequiredResponse = {
    error: 'payment_required',
    message: `Payment required to access this resource. ${challenge.description}`,
    challenge,
    docsUrl: 'https://botvisibility.com/docs/payments',
  };

  // Build WWW-Authenticate header per x402 spec
  const authHeader = buildWWWAuthenticateHeader(challenge);

  return NextResponse.json(body, {
    status: 402,
    headers: {
      'WWW-Authenticate': authHeader,
      'X-Payment-Version': 'x402/1.0',
      'X-Payment-Id': challenge.paymentId,
      'X-Payment-Expires': challenge.expiresAt.toString(),
      'Cache-Control': 'no-store', // Don't cache 402 responses
    },
  });
}

/**
 * Build WWW-Authenticate header for x402
 */
function buildWWWAuthenticateHeader(challenge: X402PaymentChallenge): string {
  const parts: string[] = ['X402'];

  // Add payment options as parameters
  for (const opt of challenge.paymentOptions) {
    parts.push(`network="${opt.network}"`);
    parts.push(`method="${opt.method}"`);
    parts.push(`amount="${opt.amount}"`);
    parts.push(`recipient="${opt.recipient}"`);
  }

  parts.push(`paymentId="${challenge.paymentId}"`);
  parts.push(`expires="${challenge.expiresAt}"`);

  return parts.join(', ');
}

// ============================================================================
// Payment Proof Extraction
// ============================================================================

/**
 * Extract payment proof from request headers.
 * Handles three formats:
 *   1. X-PAYMENT header — native x402 PaymentPayload (base64 JSON)
 *   2. X-Payment-Proof header — our legacy JSON proof
 *   3. Authorization: X402 <base64> — our legacy base64-encoded proof
 */
export function extractPaymentProof(request: Request): X402PaymentProof | null {
  // x402 native: X-PAYMENT header carries base64-encoded PaymentPayload
  const nativeHeader = request.headers.get('X-PAYMENT');
  if (nativeHeader) {
    try {
      const payload = JSON.parse(atob(nativeHeader));
      // x402 PaymentPayload carries authorization.from as sender
      const sender: string = payload?.authorization?.from ?? payload?.from ?? '';
      const syntheticProof: X402PaymentProof = {
        paymentId: payload?.paymentId ?? '',
        network: 'base',
        transactionHash: '',
        sender,
        rawX402Payload: nativeHeader,
      };
      if (syntheticProof.rawX402Payload) return syntheticProof;
    } catch {
      // fall through
    }
  }

  // Check X-Payment-Proof header (legacy method)
  const proofHeader = request.headers.get('X-Payment-Proof');
  if (proofHeader) {
    try {
      const proof = JSON.parse(proofHeader);
      if (isValidProof(proof)) {
        return proof;
      }
    } catch {
      // Invalid JSON in header
    }
  }

  // Check Authorization header with X402 scheme (legacy method)
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('X402 ')) {
    try {
      const proof = JSON.parse(atob(authHeader.substring(5)));
      if (isValidProof(proof)) {
        return proof;
      }
    } catch {
      // Invalid base64 or JSON
    }
  }

  return null;
}

/**
 * Validate proof structure
 */
function isValidProof(proof: unknown): proof is X402PaymentProof {
  if (!proof || typeof proof !== 'object') return false;
  const p = proof as Record<string, unknown>;
  return (
    typeof p.paymentId === 'string' &&
    typeof p.network === 'string' &&
    typeof p.transactionHash === 'string' &&
    typeof p.sender === 'string'
  );
}

// ============================================================================
// Payment Verification (Stub for future implementation)
// ============================================================================

/**
 * Verify a payment proof
 *
 * In production, this would:
 * 1. Query the appropriate blockchain (via x402 or Faremeter)
 * 2. Verify transaction exists and is confirmed
 * 3. Verify amount matches expected
 * 4. Verify recipient matches expected
 *
 * For now, returns a stub result that can be wired to real verification
 */
export async function verifyPaymentProof(
  proof: X402PaymentProof,
  expectedChallenge: X402PaymentChallenge
): Promise<PaymentVerificationResult> {
  const config = loadPaymentConfig();

  // In mock mode, accept any proof
  if (config.provider.provider === 'mock' && !config.requireProofValidation) {
    return {
      valid: true,
      status: 'confirmed',
      confirmations: 10,
      verifiedAmount: expectedChallenge.paymentOptions[0]?.amount ?? '0',
      verifiedAt: new Date().toISOString(),
    };
  }

  // Check basic validity
  if (proof.paymentId !== expectedChallenge.paymentId) {
    return {
      valid: false,
      status: 'failed',
      reason: 'Payment ID mismatch',
    };
  }

  // Check if payment has expired
  if (Date.now() / 1000 > expectedChallenge.expiresAt) {
    return {
      valid: false,
      status: 'expired',
      reason: 'Payment challenge has expired',
    };
  }

  // Real testnet verification via Base Sepolia RPC
  if (proof.network === 'testnet' || proof.network === 'base' || proof.network === 'base-sepolia') {
    return verifyOnBaseSepolia(proof, expectedChallenge);
  }

  return {
    valid: false,
    status: 'pending',
    reason: 'Payment verification not yet connected to settlement provider',
  };
}

/**
 * Verify a payment transaction on Base Sepolia using JSON-RPC.
 * Falls back to mock acceptance if the RPC is unreachable.
 */
async function verifyOnBaseSepolia(
  proof: X402PaymentProof,
  expectedChallenge: X402PaymentChallenge
): Promise<PaymentVerificationResult> {
  const config = loadPaymentConfig();

  try {
    const response = await fetch(BASE_SEPOLIA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionReceipt',
        params: [proof.transactionHash],
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`RPC HTTP ${response.status}`);
    }

    const data = await response.json() as {
      result: { status: string; to: string; blockNumber: string } | null;
      error?: { message: string };
    };

    if (data.error) {
      throw new Error(data.error.message);
    }

    const receipt = data.result;

    if (!receipt) {
      return {
        valid: false,
        status: 'pending',
        reason: 'Transaction not yet mined on Base Sepolia',
      };
    }

    if (receipt.status !== '0x1') {
      return {
        valid: false,
        status: 'failed',
        reason: 'Transaction reverted on-chain',
      };
    }

    // Verify recipient matches configured address (case-insensitive)
    const expectedRecipient = config.provider.recipientAddress?.toLowerCase();
    const txTo = receipt.to?.toLowerCase();
    if (expectedRecipient && txTo && txTo !== expectedRecipient) {
      return {
        valid: false,
        status: 'failed',
        reason: 'Transaction recipient does not match expected address',
      };
    }

    const blockHex = receipt.blockNumber ?? '0x0';
    const confirmations = parseInt(blockHex, 16) > 0 ? 1 : 0;

    return {
      valid: true,
      status: 'confirmed',
      confirmations,
      verifiedAmount: expectedChallenge.paymentOptions[0]?.amount ?? '0',
      verifiedAt: new Date().toISOString(),
    };
  } catch (err) {
    // Only fall back on genuine network timeout — not as a default for any provider
    const isNetworkError = err instanceof TypeError || (err instanceof Error && err.message.includes('timeout'));
    if (isNetworkError) {
      return {
        valid: false,
        status: 'failed',
        reason: 'RPC connection timeout — Base Sepolia unreachable, retry later',
      };
    }

    return {
      valid: false,
      status: 'failed',
      reason: `RPC error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if payment proof header is present (quick check without validation)
 */
export function hasPaymentProof(request: Request): boolean {
  return (
    request.headers.has('X-Payment-Proof') ||
    request.headers.get('Authorization')?.startsWith('X402 ') === true
  );
}

/**
 * Create a simple 402 response for quick rejection
 */
export function quickPaymentRequired(
  message: string = 'Payment required'
): NextResponse {
  return NextResponse.json(
    { error: 'payment_required', message },
    { status: 402, headers: { 'WWW-Authenticate': 'X402' } }
  );
}
