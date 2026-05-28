/**
 * Paid Scan API Route - HTTP 402 Payment Required
 *
 * This endpoint provides enhanced scan reports for a fee.
 * Implements x402 payment protocol for agentic payments.
 *
 * Flow:
 * 1. Client requests paid scan without payment proof -> 402 with challenge
 * 2. Client pays via x402/Faremeter settlement
 * 3. Client retries with payment proof -> scan executes
 *
 * The free /api/scan endpoint remains unchanged.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createPaymentChallenge,
  createPaymentRequiredResponse,
  extractPaymentProof,
  verifyPaymentProof,
  loadPaymentConfig,
  getPricingTier,
  isTierFree,
  X402PaymentChallenge,
} from '@/lib/payments';
import { normalizeUrl } from '@/lib/scanner';
import { runPaidScan } from './scan-service';

// In-memory store for payment challenges (would be Redis/DB in production)
const challengeStore = new Map<string, X402PaymentChallenge>();

/**
 * GET /api/scan/paid?url=...&tier=detailed
 *
 * Returns 402 Payment Required with x402 challenge if no valid payment.
 * Returns scan results if payment is verified.
 */
export async function GET(request: NextRequest) {
  const config = loadPaymentConfig();
  const searchParams = request.nextUrl.searchParams;

  // Extract parameters
  const urlParam = searchParams.get('url');
  const tierId = searchParams.get('tier') ?? 'detailed';

  // Validate URL parameter
  if (!urlParam) {
    return NextResponse.json(
      { error: 'Missing url parameter' },
      { status: 400 }
    );
  }

  let baseUrl: string;
  try {
    baseUrl = normalizeUrl(urlParam);
  } catch {
    return NextResponse.json(
      { error: 'Invalid URL' },
      { status: 400 }
    );
  }

  // Validate tier
  const tier = getPricingTier(tierId);
  if (!tier) {
    return NextResponse.json(
      { error: 'Invalid tier', availableTiers: ['free', 'detailed', 'enterprise'] },
      { status: 400 }
    );
  }

  // If tier is free, redirect to free endpoint
  if (isTierFree(tierId)) {
    return NextResponse.json(
      { error: 'Use /api/scan for free scans', redirect: `/api/scan?url=${encodeURIComponent(urlParam)}` },
      { status: 400 }
    );
  }

  // Check if payments are configured
  if (!config.paymentsEnabled) {
    return NextResponse.json(
      {
        error: 'payments_not_configured',
        message: 'Paid scans are not yet available. Use /api/scan for free scans.',
        tier: tier,
      },
      { status: 503 }
    );
  }

  // Check for payment proof
  const proof = extractPaymentProof(request);

  if (!proof) {
    // No payment proof - return 402 with challenge
    const challenge = createPaymentChallenge(
      `/api/scan/paid?url=${encodeURIComponent(baseUrl)}&tier=${tierId}`,
      tierId,
      `${request.nextUrl.origin}/api/payments/callback`
    );

    if (!challenge) {
      return NextResponse.json(
        { error: 'Payment system error', message: 'Unable to create payment challenge' },
        { status: 500 }
      );
    }

    // Store challenge for later verification
    challengeStore.set(challenge.paymentId, challenge);

    // Clean up old challenges (simple TTL)
    const now = Date.now() / 1000;
    for (const [id, ch] of challengeStore.entries()) {
      if (ch.expiresAt < now) {
        challengeStore.delete(id);
      }
    }

    return createPaymentRequiredResponse(challenge);
  }

  // Payment proof provided - verify it
  const storedChallenge = challengeStore.get(proof.paymentId);
  if (!storedChallenge) {
    return NextResponse.json(
      { error: 'invalid_payment', message: 'Payment ID not found or expired' },
      { status: 400 }
    );
  }

  const verification = await verifyPaymentProof(proof, storedChallenge);

  if (!verification.valid) {
    return NextResponse.json(
      {
        error: 'payment_verification_failed',
        message: verification.reason ?? 'Payment could not be verified',
        status: verification.status,
      },
      { status: 402 }
    );
  }

  // Payment verified - execute paid scan
  try {
    const result = await runPaidScan(baseUrl, tierId);

    // Clean up used challenge
    challengeStore.delete(proof.paymentId);

    return NextResponse.json({
      success: true,
      paymentId: proof.paymentId,
      ...result, // Includes paidTier from scan-service
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'scan_failed', message: error instanceof Error ? error.message : 'Scan failed' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/scan/paid
 * Body: { url: string, tier: string }
 *
 * Same flow as GET but accepts JSON body.
 * Payment proof still comes from headers.
 */
export async function POST(request: NextRequest) {
  const config = loadPaymentConfig();

  let body: { url?: string; tier?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const urlParam = body.url;
  const tierId = body.tier ?? 'detailed';

  if (!urlParam) {
    return NextResponse.json(
      { error: 'Missing url in request body' },
      { status: 400 }
    );
  }

  let baseUrl: string;
  try {
    baseUrl = normalizeUrl(urlParam);
  } catch {
    return NextResponse.json(
      { error: 'Invalid URL' },
      { status: 400 }
    );
  }

  const tier = getPricingTier(tierId);
  if (!tier) {
    return NextResponse.json(
      { error: 'Invalid tier' },
      { status: 400 }
    );
  }

  if (isTierFree(tierId)) {
    return NextResponse.json(
      { error: 'Use /api/scan for free scans' },
      { status: 400 }
    );
  }

  if (!config.paymentsEnabled) {
    return NextResponse.json(
      { error: 'payments_not_configured', message: 'Paid scans not yet available' },
      { status: 503 }
    );
  }

  const proof = extractPaymentProof(request);

  if (!proof) {
    const challenge = createPaymentChallenge(
      `/api/scan/paid`,
      tierId,
      `${request.nextUrl.origin}/api/payments/callback`
    );

    if (!challenge) {
      return NextResponse.json(
        { error: 'Payment system error' },
        { status: 500 }
      );
    }

    challengeStore.set(challenge.paymentId, challenge);
    return createPaymentRequiredResponse(challenge);
  }

  const storedChallenge = challengeStore.get(proof.paymentId);
  if (!storedChallenge) {
    return NextResponse.json(
      { error: 'invalid_payment', message: 'Payment ID not found or expired' },
      { status: 400 }
    );
  }

  const verification = await verifyPaymentProof(proof, storedChallenge);

  if (!verification.valid) {
    return NextResponse.json(
      { error: 'payment_verification_failed', message: verification.reason },
      { status: 402 }
    );
  }

  try {
    const result = await runPaidScan(baseUrl, tierId);
    challengeStore.delete(proof.paymentId);

    return NextResponse.json({
      success: true,
      paymentId: proof.paymentId,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'scan_failed', message: error instanceof Error ? error.message : 'Scan failed' },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS - CORS preflight for payment headers
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Payment-Proof, X-Payment-Id',
      'Access-Control-Max-Age': '86400',
    },
  });
}
