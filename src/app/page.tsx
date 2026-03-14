"use client";

import { useState, useCallback, useId, useEffect, useRef } from "react";
import { CheckResult, ScanResult, ManualCheck, Tier } from "@/lib/types";

type ScanState = "idle" | "scanning" | "complete" | "error";

// ============================================
// SPINNER COMPONENT
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
// CIRCULAR PROGRESS RING
// ============================================
function CircularProgress({
  progress,
  size = 80,
  strokeWidth = 6
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        className="progress-ring progress-ring-glow"
        width={size}
        height={size}
      >
        <circle
          className="progress-ring-background"
          cx={size / 2}
          cy={size / 2}
          r={radius}
        />
        <circle
          className="progress-ring-progress"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.5s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold" style={{ color: "var(--accent-primary)" }}>
          {Math.round(progress)}%
        </span>
      </div>
    </div>
  );
}

// ============================================
// ANIMATED COUNTER
// ============================================
function AnimatedCounter({ value, duration = 1000 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  const startTime = useRef<number | null>(null);
  const animationFrame = useRef<number | null>(null);

  useEffect(() => {
    startTime.current = null;

    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp;
      const progress = Math.min((timestamp - startTime.current) / duration, 1);

      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(easeOut * value));

      if (progress < 1) {
        animationFrame.current = requestAnimationFrame(animate);
      }
    };

    animationFrame.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, [value, duration]);

  return <span className="score-counter">{displayValue}</span>;
}

// ============================================
// CONFETTI EFFECT
// ============================================
function Confetti({ active }: { active: boolean }) {
  const [particles, setParticles] = useState<Array<{
    id: number;
    x: number;
    color: string;
    delay: number;
    size: number;
  }>>([]);

  useEffect(() => {
    if (active) {
      const colors = [
        "oklch(0.72 0.20 145)", // green
        "oklch(0.70 0.22 300)", // purple
        "oklch(0.80 0.16 85)",  // gold
        "oklch(0.75 0.18 200)", // cyan
        "oklch(0.72 0.20 30)",  // coral
      ];

      const newParticles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 500,
        size: 6 + Math.random() * 8,
      }));

      setParticles(newParticles);

      // Clear after animation
      const timer = setTimeout(() => setParticles([]), 4000);
      return () => clearTimeout(timer);
    }
  }, [active]);

  if (!active && particles.length === 0) return null;

  return (
    <div className="confetti-container" aria-hidden="true">
      {particles.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.x}%`,
            backgroundColor: p.color,
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay}ms`,
          }}
        />
      ))}
    </div>
  );
}

// ============================================
// GHOST ICON FOR INVISIBLE TIER
// ============================================
function GhostIcon({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="ghost-icon"
      aria-hidden="true"
    >
      <path
        d="M12 2C7.58 2 4 5.58 4 10v9c0 .55.45 1 1 1s1-.45 1-1v-1c0-.55.45-1 1-1s1 .45 1 1v1c0 .55.45 1 1 1s1-.45 1-1v-1c0-.55.45-1 1-1s1 .45 1 1v1c0 .55.45 1 1 1s1-.45 1-1v-1c0-.55.45-1 1-1s1 .45 1 1v1c0 .55.45 1 1 1s1-.45 1-1v-9c0-4.42-3.58-8-8-8z"
        fill="currentColor"
        opacity="0.9"
      />
      <circle cx="9" cy="10" r="1.5" fill="var(--bg-primary)" />
      <circle cx="15" cy="10" r="1.5" fill="var(--bg-primary)" />
    </svg>
  );
}

// ============================================
// TIER BADGE COMPONENT
// ============================================
function TierBadge({ tier, animated = true }: { tier: Tier; animated?: boolean }) {
  const badgeClass = {
    Invisible: "tier-badge-invisible",
    Dim: "tier-badge-dim",
    Visible: "tier-badge-visible",
    Clear: "tier-badge-clear",
    Beacon: "tier-badge-beacon",
  }[tier.name];

  const tierColorClass = {
    Invisible: "tier-invisible",
    Dim: "tier-dim",
    Visible: "tier-visible",
    Clear: "tier-clear",
    Beacon: "tier-beacon",
  }[tier.name];

  return (
    <div className={`tier-badge ${badgeClass} ${animated ? "animate-badge-reveal" : ""}`}>
      {tier.name === "Invisible" ? (
        <GhostIcon size={32} />
      ) : (
        <span className="text-3xl mr-2" aria-hidden="true">{tier.emoji}</span>
      )}
      <span className={tierColorClass}>{tier.name}</span>
    </div>
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
  const [showConfetti, setShowConfetti] = useState(false);

  const inputId = useId();
  const errorId = useId();

  const startScan = useCallback(async () => {
    if (!url.trim()) return;

    setScanState("scanning");
    setResults([]);
    setFinalResult(null);
    setError(null);
    setCurrentCheck(null);
    setShowConfetti(false);

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

        // Trigger confetti for Clear or Beacon tier
        if (data.tier.name === "Clear" || data.tier.name === "Beacon") {
          setShowConfetti(true);
        }
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

      {/* Confetti overlay */}
      <Confetti active={showConfetti} />

      <div className="min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        <div className="max-w-3xl mx-auto px-4 py-8 md:py-16">
          {/* Header */}
          <header className="mb-12">
            <h1
              className="text-3xl md:text-4xl font-bold mb-4 tracking-tight"
              style={{ fontSize: "var(--text-4xl)" }}
            >
              BotVisibility
            </h1>
            <p
              className="text-lg max-w-xl"
              style={{ color: "var(--text-secondary)", fontSize: "var(--text-lg)" }}
            >
              How visible is your product to AI agents? Scan any URL and find out in seconds.
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
                    className={`btn-primary flex items-center justify-center gap-2 min-w-[140px] ${
                      scanState === "idle" && url.trim() ? "btn-scan" : ""
                    }`}
                  >
                    {scanState === "scanning" ? (
                      <>
                        <Spinner size={18} />
                        <span>Scanning...</span>
                      </>
                    ) : (
                      <>
                        <span className="text-lg">&#128269;</span>
                        <span>Scan URL</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>

            {/* Error State */}
            {error && (
              <div
                id={errorId}
                role="alert"
                className="mb-8 p-4 rounded-lg card-fail animate-slide-in"
              >
                {error}
              </div>
            )}

            {/* Progress indicator with circular ring */}
            {scanState === "scanning" && (
              <div className="mb-8 flex flex-col items-center gap-4" aria-live="polite" aria-atomic="true">
                <CircularProgress progress={progressPercent} size={100} />

                <div className="w-full max-w-md">
                  <div
                    className="progress-bar"
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
                </div>

                {currentCheck && (
                  <p className="text-base animate-pulse" style={{ color: "var(--accent-primary)" }}>
                    Checking <span className="font-semibold">{currentCheck}</span>...
                  </p>
                )}

                <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                  {results.length} of {totalChecks} checks complete
                </p>
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
                      {results.map((result, index) => (
                        <CheckResultCard
                          key={result.id}
                          result={result}
                          index={index}
                        />
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
                <div className="mb-6 animate-float">
                  <span className="text-6xl">&#128373;</span>
                </div>
                <p className="text-lg mb-4" style={{ fontSize: "var(--text-lg)" }}>
                  Enter a URL to check your BotVisibility score
                </p>
                <p className="text-sm" style={{ fontSize: "var(--text-sm)" }}>
                  We check for llms.txt, agent-card.json, OpenAPI specs, CORS headers, and more
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
                31-item BotVisibility Checklist
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
// SCORE CARD COMPONENT — Game-like presentation
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
  const cardClass = {
    Invisible: "score-card-invisible",
    Dim: "score-card-dim",
    Visible: "score-card-visible",
    Clear: "score-card-clear",
    Beacon: "score-card-beacon",
  }[tier.name];

  const tierColorClass = {
    Invisible: "tier-invisible",
    Dim: "tier-dim",
    Visible: "tier-visible",
    Clear: "tier-clear",
    Beacon: "tier-beacon",
  }[tier.name];

  const percentage = Math.round((score / maxScore) * 100);

  return (
    <section
      aria-labelledby="score-heading"
      className={`card score-card ${cardClass} animate-scale-in`}
    >
      {/* Main score display */}
      <div className="text-center mb-6">
        <div className="mb-4">
          <TierBadge tier={tier} />
        </div>

        <div className={`score-display ${tierColorClass} mb-2`}>
          <AnimatedCounter value={autoChecks} duration={1500} />
          <span style={{ opacity: 0.5 }}>/{totalAutoChecks}</span>
        </div>

        <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          automated checks passed
        </p>
      </div>

      {/* Tier info */}
      <div className="text-center mb-6 pt-6" style={{ borderTop: "1px solid var(--border-primary)" }}>
        <p className="text-sm mb-1" style={{ color: "var(--text-tertiary)" }}>
          {tier.range}
        </p>
        <p style={{ color: "var(--text-secondary)" }}>{tier.description}</p>
      </div>

      {/* Visibility percentage bar */}
      <div className="pt-4" style={{ borderTop: "1px solid var(--border-primary)" }}>
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            Bot Visibility
          </span>
          <span className={`text-sm font-bold ${tierColorClass}`}>
            {percentage}%
          </span>
        </div>
        <div className="progress-bar" style={{ height: "12px" }}>
          <div
            className="progress-bar-fill animate-progress-pulse"
            style={{
              width: `${percentage}%`,
              animationDelay: "500ms"
            }}
          />
        </div>
      </div>
    </section>
  );
}

// ============================================
// CHECK RESULT CARD — With micro-interactions
// ============================================
function CheckResultCard({ result, index }: { result: CheckResult; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();

  const statusIcon = {
    pass: "&#10003;",
    fail: "&#10007;",
    partial: "&#9684;",
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
    <div
      className={`p-4 rounded-lg check-card animate-slide-in-right ${cardClass}`}
      role="listitem"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls={contentId}
        className="w-full text-left flex items-start gap-3 bg-transparent border-none cursor-pointer"
      >
        <span
          className={`text-xl font-bold check-icon ${statusColorClass} ${result.passed ? 'animate-check-pop' : ''}`}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: statusIcon }}
          style={{ animationDelay: `${index * 50 + 200}ms` }}
        />
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
          className="text-sm flex-shrink-0 expand-icon"
          style={{ color: "var(--text-tertiary)" }}
          aria-hidden="true"
        >
          &#9660;
        </span>
      </button>

      {expanded && (
        <div id={contentId} className="mt-3 ml-8 space-y-2 text-sm animate-slide-in">
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
                <span className="font-medium">&#128161; Recommendation:</span>{" "}
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
    4: "Beacon",
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
        <span
          className="expand-icon"
          style={{ color: "var(--text-tertiary)" }}
          aria-hidden="true"
        >
          &#9660;
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
                  {checks.map((check, i) => (
                    <li
                      key={check.id}
                      className="p-3 rounded-lg card-interactive animate-slide-in"
                      style={{
                        background: "var(--bg-tertiary)",
                        animationDelay: `${i * 30}ms`
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span style={{ color: "var(--text-tertiary)" }} aria-hidden="true">&#9744;</span>
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
