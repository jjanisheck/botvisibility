"use client";

import { useState, useCallback, useId } from "react";
import { CheckResult, ScanResult, ManualCheck, Tier } from "@/lib/types";

type ScanState = "idle" | "scanning" | "complete" | "error";

// ============================================
// SPINNER COMPONENT — Extracted, not duplicated
// ============================================
function Spinner({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================
export default function Home() {
  const [url, setUrl] = useState("");
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [currentCheck, setCurrentCheck] = useState<string | null>(null);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [finalResult, setFinalResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputId = useId();
  const errorId = useId();

  const startScan = useCallback(async () => {
    if (!url.trim()) return;

    setScanState("scanning");
    setResults([]);
    setFinalResult(null);
    setError(null);
    setCurrentCheck(null);

    try {
      const eventSource = new EventSource(
        `/api/scan?url=${encodeURIComponent(url)}`
      );

      eventSource.addEventListener("checking", (event) => {
        const data = JSON.parse(event.data);
        setCurrentCheck(data.name);
      });

      eventSource.addEventListener("result", (event) => {
        const result: CheckResult = JSON.parse(event.data);
        setResults((prev) => [...prev, result]);
        setCurrentCheck(null);
      });

      eventSource.addEventListener("complete", (event) => {
        const data: ScanResult = JSON.parse(event.data);
        setFinalResult(data);
        setScanState("complete");
        eventSource.close();
      });

      eventSource.onerror = () => {
        setError("Connection lost. Please try again.");
        setScanState("error");
        eventSource.close();
      };
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
      setScanState("error");
    }
  }, [url]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startScan();
  };

  const totalChecks = 9;
  const progressPercent = Math.round((results.length / totalChecks) * 100);

  return (
    <>
      {/* Skip link for keyboard users */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <div className="min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        <div className="max-w-3xl mx-auto px-4 py-8 md:py-16">
          {/* Header */}
          <header className="mb-12">
            <h1
              className="text-3xl md:text-4xl font-bold mb-4 tracking-tight"
              style={{ fontSize: "var(--text-4xl)" }}
            >
              Agent-Readiness Scanner
            </h1>
            <p
              className="text-lg max-w-xl"
              style={{ color: "var(--text-secondary)", fontSize: "var(--text-lg)" }}
            >
              Check if your app is ready for AI agents. Scan any URL to see how
              discoverable, usable, and optimized it is for the agentic era.
            </p>
          </header>

          {/* Main content */}
          <main id="main-content">
            {/* URL Input Form */}
            <form onSubmit={handleSubmit} className="mb-8">
              <div className="flex flex-col gap-2 mb-3">
                <label
                  htmlFor={inputId}
                  className="text-sm font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  URL to scan
                </label>
                <div className="flex flex-col md:flex-row gap-3">
                  <input
                    id={inputId}
                    type="url"
                    placeholder="https://example.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="flex-1"
                    disabled={scanState === "scanning"}
                    aria-describedby={error ? errorId : undefined}
                    aria-invalid={error ? "true" : undefined}
                  />
                  <button
                    type="submit"
                    disabled={scanState === "scanning" || !url.trim()}
                    className="btn-primary flex items-center justify-center gap-2 min-w-[120px]"
                  >
                    {scanState === "scanning" ? (
                      <>
                        <Spinner size={18} />
                        <span>Scanning</span>
                      </>
                    ) : (
                      "Scan URL"
                    )}
                  </button>
                </div>
              </div>
            </form>

            {/* Error State — Associated with input */}
            {error && (
              <div
                id={errorId}
                role="alert"
                className="mb-8 p-4 rounded-lg card-fail"
              >
                {error}
              </div>
            )}

            {/* Progress indicator — Accessible */}
            {scanState === "scanning" && (
              <div className="mb-8" aria-live="polite" aria-atomic="true">
                <div
                  className="progress-bar mb-2"
                  role="progressbar"
                  aria-valuenow={progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Scan progress"
                >
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                {currentCheck && (
                  <p className="text-sm animate-pulse" style={{ color: "var(--text-secondary)" }}>
                    Checking {currentCheck}...
                  </p>
                )}
              </div>
            )}

            {/* Results */}
            {(results.length > 0 || finalResult) && (
              <div className="space-y-6">
                {/* Score Card */}
                {finalResult && (
                  <ScoreCard
                    score={finalResult.score}
                    maxScore={finalResult.maxScore}
                    tier={finalResult.tier}
                    autoChecks={results.filter((r) => r.passed).length}
                    totalAutoChecks={results.length}
                  />
                )}

                {/* Auto-detected checks */}
                <section aria-labelledby="auto-checks-heading">
                  <div className="card">
                    <h2
                      id="auto-checks-heading"
                      className="text-xl font-semibold mb-4"
                      style={{ fontSize: "var(--text-xl)" }}
                    >
                      Automated Checks ({results.filter((r) => r.passed).length}/
                      {results.length} passed)
                    </h2>
                    <div className="space-y-3" role="list" aria-live="polite">
                      {results.map((result) => (
                        <CheckResultCard key={result.id} result={result} />
                      ))}
                      {currentCheck && (
                        <div
                          className="flex items-center gap-3 p-3 rounded-lg animate-pulse"
                          style={{ background: "var(--bg-tertiary)" }}
                          role="listitem"
                        >
                          <Spinner size={16} className="text-amber-500" />
                          <span style={{ color: "var(--text-secondary)" }}>{currentCheck}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                {/* Manual checks section */}
                {finalResult && (
                  <ManualChecksSection manualChecks={finalResult.manualChecks} />
                )}
              </div>
            )}

            {/* Empty state */}
            {scanState === "idle" && results.length === 0 && (
              <div className="text-center py-12" style={{ color: "var(--text-tertiary)" }}>
                <p className="text-lg mb-4" style={{ fontSize: "var(--text-lg)" }}>
                  Enter a URL above to scan for agent-readiness
                </p>
                <p className="text-sm" style={{ fontSize: "var(--text-sm)" }}>
                  We&apos;ll check for llms.txt, agent-card.json, OpenAPI specs, and
                  more
                </p>
              </div>
            )}
          </main>

          {/* Footer */}
          <footer className="mt-16 pt-8 border-t text-center text-sm" style={{ borderColor: "var(--border-primary)", color: "var(--text-tertiary)" }}>
            <p>
              Based on the{" "}
              <a
                href="https://github.com/joeyjanisheck/agent-readiness-audit"
                className="transition-colors"
                style={{ color: "var(--text-secondary)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
              >
                31-item Agent-Readiness Checklist
              </a>
              {" · "}
              Built by{" "}
              <a
                href="https://janisheck.com"
                className="transition-colors"
                style={{ color: "var(--text-secondary)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
              >
                Joey Janisheck
              </a>
            </p>
          </footer>
        </div>
      </div>
    </>
  );
}

// ============================================
// SCORE CARD COMPONENT
// ============================================
function ScoreCard({
  score,
  maxScore,
  tier,
  autoChecks,
  totalAutoChecks,
}: {
  score: number;
  maxScore: number;
  tier: Tier;
  autoChecks: number;
  totalAutoChecks: number;
}) {
  const tierColorClass = {
    Invisible: "tier-invisible",
    Findable: "tier-findable",
    Usable: "tier-usable",
    Ready: "tier-ready",
    "Agent-Native": "tier-agent-native",
  }[tier.name];

  const percentage = Math.round((score / maxScore) * 100);

  return (
    <section aria-labelledby="score-heading" className="card animate-slide-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl" aria-hidden="true">{tier.emoji}</span>
            <div>
              <h2 id="score-heading" className={`text-2xl font-bold ${tierColorClass}`}>
                {tier.name}
              </h2>
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>{tier.range}</p>
            </div>
          </div>
          <p style={{ color: "var(--text-secondary)" }}>{tier.description}</p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold" style={{ fontSize: "var(--text-4xl)" }}>
            {autoChecks}
            <span style={{ color: "var(--text-tertiary)" }}>/{totalAutoChecks}</span>
          </div>
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>auto-detected</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
            {percentage}% agent-ready (auto-scan)
          </p>
        </div>
      </div>
    </section>
  );
}

// ============================================
// CHECK RESULT CARD — Keyboard accessible
// ============================================
function CheckResultCard({ result }: { result: CheckResult }) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();

  const statusIcon = {
    pass: "✓",
    fail: "✗",
    partial: "◐",
    unknown: "?",
  }[result.status];

  const statusColorClass = {
    pass: "status-pass",
    fail: "status-fail",
    partial: "status-partial",
    unknown: "status-unknown",
  }[result.status];

  const cardClass = {
    pass: "card-pass",
    fail: "card-fail",
    partial: "card-partial",
    unknown: "card-unknown",
  }[result.status];

  return (
    <div className={`p-4 rounded-lg animate-slide-in ${cardClass}`} role="listitem">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls={contentId}
        className="w-full text-left flex items-start gap-3 bg-transparent border-none cursor-pointer"
      >
        <span className={`text-lg font-bold ${statusColorClass}`} aria-hidden="true">
          {statusIcon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{result.name}</span>
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
            >
              Level {result.level}
            </span>
            <span className="sr-only">
              {result.status === "pass" ? "Passed" : result.status === "fail" ? "Failed" : result.status}
            </span>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {result.message}
          </p>
        </div>
        <span
          className="text-sm flex-shrink-0"
          style={{ color: "var(--text-tertiary)" }}
          aria-hidden="true"
        >
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && (
        <div id={contentId} className="mt-3 ml-8 space-y-2 text-sm">
          {result.details && (
            <p style={{ color: "var(--text-tertiary)" }}>{result.details}</p>
          )}
          {result.foundAt && (
            <p style={{ color: "var(--text-tertiary)" }}>
              Found at:{" "}
              <a
                href={result.foundAt}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                style={{ color: "var(--accent-primary)" }}
              >
                {result.foundAt}
              </a>
            </p>
          )}
          {result.recommendation && (
            <div className="p-3 rounded-lg" style={{ background: "var(--bg-tertiary)" }}>
              <p style={{ color: "var(--text-secondary)" }}>
                <span className="font-medium">Recommendation:</span>{" "}
                {result.recommendation}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// MANUAL CHECKS SECTION
// ============================================
function ManualChecksSection({
  manualChecks,
}: {
  manualChecks: ManualCheck[];
}) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();

  const groupedChecks = manualChecks.reduce(
    (acc, check) => {
      if (!acc[check.level]) acc[check.level] = [];
      acc[check.level].push(check);
      return acc;
    },
    {} as Record<number, ManualCheck[]>
  );

  const levelNames: Record<number, string> = {
    1: "Discoverable",
    2: "Usable",
    3: "Optimized",
    4: "Agent-Native",
  };

  return (
    <section aria-labelledby="manual-checks-heading" className="card">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls={contentId}
        className="w-full flex items-center justify-between bg-transparent border-none cursor-pointer text-left"
      >
        <div>
          <h2
            id="manual-checks-heading"
            className="text-xl font-semibold"
            style={{ fontSize: "var(--text-xl)" }}
          >
            Complete Your Score ({manualChecks.length} manual checks)
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            These items require manual verification
          </p>
        </div>
        <span style={{ color: "var(--text-tertiary)" }} aria-hidden="true">
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && (
        <div id={contentId} className="mt-6 space-y-6">
          {Object.entries(groupedChecks)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([level, checks]) => (
              <div key={level}>
                <h3
                  className="text-sm font-medium uppercase tracking-wider mb-3"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Level {level}: {levelNames[Number(level)]}
                </h3>
                <ul className="space-y-2" role="list">
                  {checks.map((check) => (
                    <li
                      key={check.id}
                      className="p-3 rounded-lg"
                      style={{ background: "var(--bg-tertiary)" }}
                    >
                      <div className="flex items-center gap-2">
                        <span style={{ color: "var(--text-tertiary)" }} aria-hidden="true">☐</span>
                        <span className="font-medium">{check.name}</span>
                      </div>
                      <p className="text-sm mt-1 ml-6" style={{ color: "var(--text-secondary)" }}>
                        {check.description}
                      </p>
                      <p className="text-xs mt-1 ml-6" style={{ color: "var(--text-tertiary)" }}>
                        Why: {check.why}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}
