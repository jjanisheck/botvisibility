import { NextRequest } from 'next/server';
import {
  normalizeUrl,
  checkLlmsTxt,
  checkAgentCard,
  checkOpenApiSpec,
  checkRobotsTxt,
  checkStructuredData,
  checkCorsHeaders,
  checkOpenIdConfig,
  checkRateLimitHeaders,
  checkCachingHeaders
} from '@/lib/scanner';
import { calculateScore, getTier, MANUAL_CHECKS } from '@/lib/scoring';
import { CheckResult, ScanResult } from '@/lib/types';

// Stream scan results as Server-Sent Events
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const urlParam = searchParams.get('url');

  if (!urlParam) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let baseUrl: string;
  try {
    baseUrl = normalizeUrl(urlParam);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid URL' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (type: string, data: unknown) => {
        const event = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(event));
      };

      // Send start event
      sendEvent('start', { url: baseUrl, timestamp: new Date().toISOString() });

      const checks: CheckResult[] = [];
      const checkFunctions = [
        { name: 'llms.txt', fn: checkLlmsTxt },
        { name: 'Agent Card', fn: checkAgentCard },
        { name: 'OpenAPI Spec', fn: checkOpenApiSpec },
        { name: 'robots.txt', fn: checkRobotsTxt },
        { name: 'Documentation', fn: checkStructuredData },
        { name: 'CORS Headers', fn: checkCorsHeaders },
        { name: 'OpenID Config', fn: checkOpenIdConfig },
        { name: 'Rate Limit Headers', fn: checkRateLimitHeaders },
        { name: 'Caching Headers', fn: checkCachingHeaders },
      ];

      // Run each check and stream results
      for (const { name, fn } of checkFunctions) {
        sendEvent('checking', { name });

        try {
          const result = await fn(baseUrl);
          checks.push(result);
          sendEvent('result', result);
        } catch (error) {
          const errorResult: CheckResult = {
            id: 'error',
            name,
            passed: false,
            status: 'unknown',
            level: 1,
            category: 'Error',
            autoDetectable: true,
            message: 'Check failed',
            details: error instanceof Error ? error.message : 'Unknown error'
          };
          checks.push(errorResult);
          sendEvent('result', errorResult);
        }
      }

      // Calculate final score and tier
      const score = calculateScore(checks);
      const tier = getTier(score, checks.length); // 31 total items

      const finalResult: ScanResult = {
        url: baseUrl,
        timestamp: new Date().toISOString(),
        score,
        maxScore: checks.length,
        tier,
        checks,
        manualChecks: MANUAL_CHECKS
      };

      sendEvent('complete', finalResult);
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// Non-streaming version for JSON response
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const urlParam = body.url;

    if (!urlParam) {
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let baseUrl: string;
    try {
      baseUrl = normalizeUrl(urlParam);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Run all checks in parallel
    const checks = await Promise.all([
      checkLlmsTxt(baseUrl),
      checkAgentCard(baseUrl),
      checkOpenApiSpec(baseUrl),
      checkRobotsTxt(baseUrl),
      checkStructuredData(baseUrl),
      checkCorsHeaders(baseUrl),
      checkOpenIdConfig(baseUrl),
      checkRateLimitHeaders(baseUrl),
      checkCachingHeaders(baseUrl),
    ]);

    const score = calculateScore(checks);
    const tier = getTier(score, checks.length);

    const result: ScanResult = {
      url: baseUrl,
      timestamp: new Date().toISOString(),
      score,
      maxScore: checks.length,
      tier,
      checks,
      manualChecks: MANUAL_CHECKS
    };

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
