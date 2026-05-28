/**
 * Payment Configuration Helpers
 *
 * Loads payment configuration from environment variables.
 * NEVER hardcodes secrets - all sensitive values come from env.
 */

import {
  PaymentConfig,
  PaymentProviderConfig,
  ScanPricingTier,
  PaymentNetwork,
  PaymentMethod,
} from './types';

// ============================================================================
// Environment Helpers
// ============================================================================

/**
 * Get environment variable with type safety
 */
function getEnv(key: string, defaultValue?: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] ?? defaultValue;
  }
  return defaultValue;
}

/**
 * Get boolean from environment
 */
function getEnvBool(key: string, defaultValue: boolean = false): boolean {
  const val = getEnv(key);
  if (!val) return defaultValue;
  return val.toLowerCase() === 'true' || val === '1';
}

/**
 * Get number from environment
 */
function getEnvNumber(key: string, defaultValue: number): number {
  const val = getEnv(key);
  if (!val) return defaultValue;
  const num = parseInt(val, 10);
  return isNaN(num) ? defaultValue : num;
}

// ============================================================================
// Default Pricing Tiers
// ============================================================================

/**
 * Default scan pricing tiers
 * Can be overridden via environment or config
 */
export const DEFAULT_PRICING_TIERS: ScanPricingTier[] = [
  {
    id: 'free',
    name: 'Free Scan',
    description: 'Basic bot visibility scan',
    features: [
      'Core automated checks',
      'Visibility score',
      'Tier assessment',
    ],
    priceUsdCents: 0,
    enabled: true,
  },
  {
    id: 'detailed',
    name: 'Detailed Report',
    description: 'Comprehensive scan with recommendations',
    features: [
      'All free features',
      'Detailed recommendations',
      'Priority action items',
      'Implementation guides',
      'PDF export',
    ],
    priceUsdCents: 199, // $1.99
    enabled: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise Audit',
    description: 'Full audit with consulting notes',
    features: [
      'All detailed features',
      'Manual review items',
      'Custom integrations analysis',
      'Security assessment',
      'Priority support',
    ],
    priceUsdCents: 999, // $9.99
    enabled: false, // Not yet available
  },
];

// ============================================================================
// Provider Configuration
// ============================================================================

/**
 * Get provider configuration from environment
 */
function getProviderConfig(): PaymentProviderConfig {
  const provider = getEnv('PAYMENT_PROVIDER', 'mock') as 'x402' | 'faremeter' | 'mock';
  const enabled = getEnvBool('PAYMENTS_ENABLED', false);

  // Parse enabled networks from comma-separated list
  const networksStr = getEnv('PAYMENT_NETWORKS', 'testnet');
  const networks = (networksStr?.split(',').map(n => n.trim()) ?? ['testnet']) as PaymentNetwork[];

  const defaultMethod = getEnv('PAYMENT_DEFAULT_METHOD', 'USDC') as PaymentMethod;

  return {
    provider,
    enabled,
    apiEndpoint: getEnv('PAYMENT_API_ENDPOINT'),
    webhookSecret: getEnv('PAYMENT_WEBHOOK_SECRET'),
    networks,
    defaultMethod,
    recipientAddress: getEnv('PAYMENT_RECIPIENT_ADDRESS'),
    expirySeconds: getEnvNumber('PAYMENT_EXPIRY_SECONDS', 3600), // 1 hour default
  };
}

// ============================================================================
// Main Configuration
// ============================================================================

/**
 * Load full payment configuration
 * Safe to call at runtime - reads from environment
 */
export function loadPaymentConfig(): PaymentConfig {
  const provider = getProviderConfig();

  return {
    paymentsEnabled: provider.enabled && !!provider.recipientAddress,
    provider,
    tiers: DEFAULT_PRICING_TIERS,
    minimumAmountCents: getEnvNumber('PAYMENT_MINIMUM_CENTS', 50), // $0.50 minimum
    requireProofValidation: getEnvBool('PAYMENT_REQUIRE_VALIDATION', true),
  };
}

/**
 * Get a specific pricing tier by ID
 */
export function getPricingTier(tierId: string): ScanPricingTier | undefined {
  return DEFAULT_PRICING_TIERS.find(t => t.id === tierId);
}

/**
 * Get all enabled pricing tiers
 */
export function getEnabledTiers(): ScanPricingTier[] {
  return DEFAULT_PRICING_TIERS.filter(t => t.enabled);
}

/**
 * Check if a tier is free
 */
export function isTierFree(tierId: string): boolean {
  const tier = getPricingTier(tierId);
  return tier?.priceUsdCents === 0;
}

/**
 * Check if payments are properly configured
 */
export function isPaymentSystemReady(): boolean {
  const config = loadPaymentConfig();
  return (
    config.paymentsEnabled &&
    config.provider.enabled &&
    !!config.provider.recipientAddress &&
    config.provider.networks.length > 0
  );
}

// ============================================================================
// Mock Configuration for Development
// ============================================================================

/**
 * Get mock payment config for development/testing
 * Uses test addresses that are clearly marked as non-production
 */
export function getMockPaymentConfig(): PaymentConfig {
  return {
    paymentsEnabled: true,
    provider: {
      provider: 'mock',
      enabled: true,
      apiEndpoint: 'http://localhost:3001/mock-payments',
      networks: ['testnet'],
      defaultMethod: 'USDC',
      recipientAddress: '0x0000000000000000000000000000000000000001', // Clearly invalid
      expirySeconds: 300, // 5 minutes for testing
    },
    tiers: DEFAULT_PRICING_TIERS,
    minimumAmountCents: 0, // No minimum for testing
    requireProofValidation: false, // Skip validation in mock mode
  };
}
