"use client";

import { useState, useCallback, useId, useEffect, useRef, useMemo } from "react";
import { CheckResult, ScanResult, ManualCheck, Tier } from "@/lib/types";

type ScanState = "idle" | "scanning" | "complete" | "error";

// ============================================
// ANIMATED BACKGROUND
// ============================================
function AnimatedBackground() {
  const particles = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      delay: `${Math.random() * 8}s`,
    })), []
  );

  return (
    <div className="hero-background" aria-hidden="true">
      {/* Grid pattern */}
      <div className="grid-pattern" />

      {/* Animated scan line */}
      <div className="scan-line" />

      {/* Floating particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{ left: p.left, top: p.top, animationDelay: p.delay }}
        />
      ))}

      {/* Ambient glow orbs */}
      <div
        className="glow-orb"
        style={{
          width: 600,
          height: 600,
          left: "10%",
          top: "10%",
          background: "radial-gradient(circle, oklch(0.78 0.18 200 / 0.15), transparent)",
        }}
      />
      <div
        className="glow-orb"
        style={{
          width: 400,
          height: 400,
          right: "5%",
          bottom: "20%",
          background: "radial-gradient(circle, oklch(0.72 0.25 290 / 0.1), transparent)",
          animationDelay: "3s",
        }}
      />
    </div>
  );
}

// ============================================
// RADAR ICON FOR LOGO
// ============================================
function RadarIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="28" stroke="url(#radarGrad)" strokeWidth="2" opacity="0.5" />
      <circle cx="32" cy="32" r="20" stroke="url(#radarGrad)" strokeWidth="1.5" opacity="0.3" />
      <circle cx="32" cy="32" r="12" stroke="url(#radarGrad)" strokeWidth="1" opacity="0.2" />
      <line x1="32" y1="4" x2="32" y2="60" stroke="url(#radarGrad)" strokeWidth="1" opacity="0.2" />
      <line x1="4" y1="32" x2="60" y2="32" stroke="url(#radarGrad)" strokeWidth="1" opacity="0.2" />
      <path
        d="M32 32 L32 8 A24 24 0 0 1 56 32 Z"
        fill="url(#sweepGrad)"
        opacity="0.6"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 32 32"
          to="360 32 32"
          dur="3s"
          repeatCount="indefinite"
        />
      </path>
      <circle cx="32" cy="32" r="4" fill="url(#radarGrad)" />
      <defs>
        <linearGradient id="radarGrad" x1="0" y1="0" x2="64" y2="64">
          <stop stopColor="oklch(0.78 0.18 200)" />
          <stop offset="1" stopColor="oklch(0.72 0.25 290)" />
        </linearGradient>
        <linearGradient id="sweepGrad" x1="32" y1="32" x2="56" y2="8">
          <stop stopColor="oklch(0.78 0.18 200 / 0.4)" />
          <stop offset="1" stopColor="oklch(0.78 0.18 200 / 0)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ============================================
// SPINNER
// ============================================
function Spinner({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      className={`spinner ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="60"
        strokeDashoffset="20"
      />
    </svg>
  );
}

// ============================================
// RADAR SCANNING ANIMATION
// ============================================
function RadarScanning({ progress }: { progress: number }) {
  return (
    <div className="radar-container">
      <div className="radar-ring" />
      <div className="radar-ring-inner" />
      <div className="radar-ring-core" />
      <div className="radar-crosshair" />
      <div className="radar-sweep" />

      {/* Animated blips based on progress */}
      {progress > 20 && (
        <div className="radar-blip" style={{ left: "70%", top: "30%" }} />
      )}
      {progress > 50 && (
        <div className="radar-blip" style={{ left: "25%", top: "60%", animationDelay: "0.5s" }} />
      )}
      {progress > 80 && (
        <div className="radar-blip" style={{ left: "60%", top: "70%", animationDelay: "1s" }} />
      )}

      <div className="radar-center-text">
        <span className="radar-percentage">{Math.round(progress)}%</span>
        <span className="radar-label">Scanning</span>
      </div>
    </div>
  );
}

// ============================================
// SCORE GAUGE — Speedtest Style
// ============================================
function ScoreGauge({
  score,
  maxScore,
  tierColor,
}: {
  score: number;
  maxScore: number;
  tierColor: string;
}) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const percentage = (score / maxScore) * 100;

  // Gauge arc calculation
  const radius = 120;
  const strokeWidth = 24;
  const circumference = Math.PI * radius; // Half circle
  const offset = circumference - (animatedScore / maxScore) * circumference;

  useEffect(() => {
    const duration = 1500;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(easeOut * score));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [score]);

  return (
    <div className="gauge-container">
      <svg className="gauge-svg" viewBox="0 0 280 160">
        {/* Background track */}
        <path
          d="M 20 140 A 120 120 0 0 1 260 140"
          className="gauge-track"
        />
        {/* Filled arc */}
        <path
          d="M 20 140 A 120 120 0 0 1 260 140"
          className="gauge-fill"
          style={{
            stroke: tierColor,
            strokeDasharray: circumference,
            strokeDashoffset: offset,
            "--gauge-color": tierColor,
          } as React.CSSProperties}
        />
        {/* Tick marks */}
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
          const angle = (180 * i) / 9 - 180;
          const rad = (angle * Math.PI) / 180;
          const x1 = 140 + 105 * Math.cos(rad);
          const y1 = 140 + 105 * Math.sin(rad);
          const x2 = 140 + 115 * Math.cos(rad);
          const y2 = 140 + 115 * Math.sin(rad);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="oklch(0.4 0.02 260)"
              strokeWidth={i === 0 || i === 9 ? 2 : 1}
            />
          );
        })}
      </svg>
      <div className="gauge-center">
        <span className="gauge-score" style={{ color: tierColor }}>
          {animatedScore}
          <span className="gauge-max">/{maxScore}</span>
        </span>
        <div className="gauge-label">Checks Passed</div>
      </div>
    </div>
  );
}

// ============================================
// SIGNAL STRENGTH BARS
// ============================================
function SignalBars({ tier }: { tier: Tier }) {
  const tierToLevel: Record<string, number> = {
    Invisible: 1,
    Dim: 2,
    Visible: 3,
    Clear: 4,
    Beacon: 5,
  };

  const tierToColor: Record<string, string> = {
    Invisible: "var(--tier-invisible)",
    Dim: "var(--tier-dim)",
    Visible: "var(--tier-visible)",
    Clear: "var(--tier-clear)",
    Beacon: "var(--tier-beacon)",
  };

  const level = tierToLevel[tier.name];
  const color = tierToColor[tier.name];

  return (
    <div className="signal-bars">
      {[1, 2, 3, 4, 5].map((bar) => (
        <div
          key={bar}
          className={`signal-bar ${bar <= level ? "active" : ""}`}
          style={{
            backgroundColor: bar <= level ? color : undefined,
            color: bar <= level ? color : undefined,
          }}
        />
      ))}
    </div>
  );
}

// ============================================
// GHOST ICON
// ============================================
function GhostIcon({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="ghost-icon"
    >
      <path
        d="M12 2C7.58 2 4 5.58 4 10v9c0 .55.45 1 1 1s1-.45 1-1v-1c0-.55.45-1 1-1s1 .45 1 1v1c0 .55.45 1 1 1s1-.45 1-1v-1c0-.55.45-1 1-1s1 .45 1 1v1c0 .55.45 1 1 1s1-.45 1-1v-1c0-.55.45-1 1-1s1 .45 1 1v1c0 .55.45 1 1 1s1-.45 1-1v-9c0-4.42-3.58-8-8-8z"
        fill="currentColor"
      />
      <circle cx="9" cy="10" r="1.5" fill="var(--bg-primary)" />
      <circle cx="15" cy="10" r="1.5" fill="var(--bg-primary)" />
    </svg>
  );
}

// ============================================
// TIER BADGE
// ============================================
function TierBadge({ tier }: { tier: Tier }) {
  const badgeClass = `tier-badge-${tier.name.toLowerCase()}`;

  return (
    <div className={`tier-badge-large ${badgeClass}`}>
      {tier.name === "Invisible" ? (
        <GhostIcon size={40} />
      ) : (
        <span className="tier-emoji">{tier.emoji}</span>
      )}
      <span>{tier.name}</span>
    </div>
  );
}

// ============================================
// CONFETTI
// ============================================
function Confetti({ active }: { active: boolean }) {
  const [particles, setParticles] = useState<Array<{
    id: number;
    x: number;
    color: string;
    delay: number;
    size: number;
    shape: "circle" | "square" | "triangle";
  }>>([]);

  useEffect(() => {
    if (active) {
      const colors = [
        "oklch(0.75 0.22 145)",
        "oklch(0.72 0.25 290)",
        "oklch(0.78 0.18 200)",
        "oklch(0.80 0.16 85)",
        "oklch(0.75 0.20 55)",
      ];
      const shapes: Array<"circle" | "square" | "triangle"> = ["circle", "square", "triangle"];

      const newParticles = Array.from({ length: 60 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 600,
        size: 8 + Math.random() * 12,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
      }));

      setParticles(newParticles);
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
            borderRadius: p.shape === "circle" ? "50%" : p.shape === "square" ? "2px" : "0",
            clipPath: p.shape === "triangle" ? "polygon(50% 0%, 0% 100%, 100% 100%)" : undefined,
          }}
        />
      ))}
    </div>
  );
}

// ============================================
// MAIN PAGE
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
  const inputRef = useRef<HTMLInputElement>(null);

  const startScan = useCallback(async () => {
    if (!url.trim()) return;

    // Auto-prepend https:// if no protocol specified
    const scanUrl = url.match(/^https?:\/\//) ? url : `https://${url}`;

    setScanState("scanning");
    setResults([]);
    setFinalResult(null);
    setError(null);
    setCurrentCheck(null);
    setShowConfetti(false);

    try {
      const eventSource = new EventSource(
        `/api/scan?url=${encodeURIComponent(scanUrl)}`
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

  const resetScan = () => {
    setUrl("");
    setScanState("idle");
    setResults([]);
    setFinalResult(null);
    setError(null);
    setShowConfetti(false);
    inputRef.current?.focus();
  };

  const totalChecks = 9;
  const progressPercent = Math.round((results.length / totalChecks) * 100);

  const tierColors: Record<string, string> = {
    Invisible: "var(--tier-invisible)",
    Dim: "var(--tier-dim)",
    Visible: "var(--tier-visible)",
    Clear: "var(--tier-clear)",
    Beacon: "var(--tier-beacon)",
  };

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <Confetti active={showConfetti} />
      <AnimatedBackground />

      <div className="min-h-screen relative z-10">
        <div className="max-w-4xl mx-auto px-4 py-12 md:py-20">

          {/* Header / Hero */}
          <header className="mb-12 md:mb-16">
            <div className="logo-container">
              <div className="logo-icon">
                <RadarIcon size={64} />
              </div>
              <h1 className="logo-text">BotVisibility</h1>
            </div>
            <p className="tagline">
              How visible is your product to AI agents? Scan any URL and find out in seconds.
            </p>
          </header>

          {/* Main */}
          <main id="main-content">
            {/* Command Center Input */}
            <form onSubmit={handleSubmit} className="mb-10">
              <label htmlFor={inputId} className="sr-only">
                URL to scan
              </label>
              <div className="command-center">
                <div className="command-input-wrapper">
                  <span className="url-prefix">https://</span>
                  <input
                    ref={inputRef}
                    id={inputId}
                    type="text"
                    placeholder="yoursite.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="command-input"
                    disabled={scanState === "scanning"}
                    aria-describedby={error ? errorId : undefined}
                    aria-invalid={error ? "true" : undefined}
                  />
                  <button
                    type="submit"
                    disabled={scanState === "scanning" || !url.trim()}
                    className={`scan-button ${
                      scanState === "idle" && url.trim() ? "scan-button-ready" : ""
                    }`}
                  >
                    {scanState === "scanning" ? (
                      <>
                        <Spinner size={20} />
                        <span>Scanning...</span>
                      </>
                    ) : (
                      <>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="8" />
                          <path d="m21 21-4.35-4.35" />
                        </svg>
                        <span>Scan URL</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>

            {/* Error */}
            {error && (
              <div
                id={errorId}
                role="alert"
                className="mb-8 p-4 rounded-xl animate-in"
                style={{
                  background: "oklch(0.60 0.25 25 / 0.1)",
                  border: "1px solid oklch(0.60 0.25 25 / 0.3)",
                  color: "var(--color-error)",
                }}
              >
                {error}
              </div>
            )}

            {/* Scanning State */}
            {scanState === "scanning" && (
              <div className="mb-12 animate-in">
                <RadarScanning progress={progressPercent} />

                <div className="mt-8 max-w-md mx-auto">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {currentCheck && (
                  <div className="mt-6 flex justify-center">
                    <div className="scanning-status">
                      <Spinner size={16} />
                      <span>Checking <strong>{currentCheck}</strong>...</span>
                    </div>
                  </div>
                )}

                <p className="text-center mt-4 text-sm" style={{ color: "var(--text-tertiary)" }}>
                  {results.length} of {totalChecks} checks complete
                </p>
              </div>
            )}

            {/* Results */}
            {(results.length > 0 || finalResult) && scanState !== "scanning" && (
              <div className="space-y-8 animate-scale-in">
                {/* Score Card */}
                {finalResult && (
                  <section
                    className={`score-card score-card-${finalResult.tier.name.toLowerCase()}`}
                  >
                    {/* Tier Badge */}
                    <div className="flex flex-col items-center mb-8">
                      <TierBadge tier={finalResult.tier} />
                      <div className="mt-4">
                        <SignalBars tier={finalResult.tier} />
                      </div>
                    </div>

                    {/* Score Gauge */}
                    <ScoreGauge
                      score={results.filter((r) => r.passed).length}
                      maxScore={results.length}
                      tierColor={tierColors[finalResult.tier.name]}
                    />

                    {/* Tier Description */}
                    <div className="text-center mt-6 pt-6" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                      <p className="text-sm mb-1" style={{ color: "var(--text-tertiary)" }}>
                        {finalResult.tier.range}
                      </p>
                      <p style={{ color: "var(--text-secondary)", maxWidth: 400, margin: "0 auto" }}>
                        {finalResult.tier.description}
                      </p>
                    </div>
                  </section>
                )}

                {/* Automated Checks */}
                <section className="card">
                  <div className="card-header">
                    <div>
                      <h2 className="card-title">
                        Automated Checks
                      </h2>
                      <p className="card-subtitle">
                        {results.filter((r) => r.passed).length}/{results.length} passed
                      </p>
                    </div>
                  </div>
                  <div className="check-grid">
                    {results.map((result, index) => (
                      <CheckResultCard key={result.id} result={result} index={index} />
                    ))}
                  </div>
                </section>

                {/* Manual Checks */}
                {finalResult && (
                  <ManualChecksSection manualChecks={finalResult.manualChecks} />
                )}
              </div>
            )}

            {/* Empty State */}
            {scanState === "idle" && results.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">
                  <RadarIcon size={100} />
                </div>
                <p className="empty-title">
                  Enter a URL to check your BotVisibility score
                </p>
                <p className="empty-subtitle">
                  We check for llms.txt, agent-card.json, OpenAPI specs, CORS headers, and more
                </p>
              </div>
            )}
          </main>

          {/* Footer */}
          <footer className="footer">
            <div className="footer-content">
              {/* Quick Actions */}
              {scanState === "complete" && (
                <div className="footer-actions">
                  <button onClick={resetScan} className="footer-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                    </svg>
                    Scan Another URL
                  </button>
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                      `Just scanned my site for AI agent readiness and got ${finalResult?.tier.name} tier! Check your BotVisibility score:`
                    )}&url=${encodeURIComponent("https://botvisibility.com")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-btn"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    Share on X
                  </a>
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent("https://botvisibility.com")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-btn"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                    Share on LinkedIn
                  </a>
                </div>
              )}

              {/* Links */}
              <div className="footer-links">
                <span>
                  Based on the{" "}
                  <a
                    href="https://github.com/joeyjanisheck/agent-readiness-audit"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    31-item BotVisibility Checklist
                  </a>
                </span>
                <span>·</span>
                <span>
                  Built by{" "}
                  <a href="https://janisheck.com" target="_blank" rel="noopener noreferrer">
                    Joey Janisheck
                  </a>
                </span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}

// ============================================
// CHECK RESULT CARD
// ============================================
function CheckResultCard({ result, index }: { result: CheckResult; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();

  const statusIcon: Record<string, string> = {
    pass: "✓",
    fail: "✕",
    partial: "◐",
    unknown: "?",
  };

  return (
    <div
      className="check-item animate-slide-in"
      style={{ animationDelay: `${index * 50}ms` }}
      role="listitem"
      aria-expanded={expanded}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-controls={contentId}
        className="w-full text-left flex items-start gap-4 bg-transparent border-none cursor-pointer p-0"
        style={{ all: "unset", display: "flex", alignItems: "flex-start", gap: "1rem", width: "100%", cursor: "pointer" }}
      >
        <div className={`check-status-indicator check-status-${result.status}`}>
          {statusIcon[result.status]}
        </div>
        <div className="check-content">
          <div className="check-header">
            <span className="check-name">{result.name}</span>
            <span className="check-level-badge">Level {result.level}</span>
          </div>
          <p className="check-message">{result.message}</p>

          {expanded && (
            <div id={contentId} className="check-details">
              {result.details && <p>{result.details}</p>}
              {result.foundAt && (
                <p>
                  Found at:{" "}
                  <a
                    href={result.foundAt}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--color-accent)" }}
                  >
                    {result.foundAt}
                  </a>
                </p>
              )}
              {result.recommendation && (
                <div className="check-recommendation">
                  <strong>Recommendation:</strong> {result.recommendation}
                </div>
              )}
            </div>
          )}
        </div>
        <svg
          className="check-expand"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    </div>
  );
}

// ============================================
// MANUAL CHECKS SECTION
// ============================================
function ManualChecksSection({ manualChecks }: { manualChecks: ManualCheck[] }) {
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
    <section className="card">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls={contentId}
        className="w-full flex items-center justify-between bg-transparent border-none cursor-pointer text-left p-0"
        style={{ all: "unset", display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", cursor: "pointer" }}
      >
        <div>
          <h2 className="card-title">
            Complete Your Score
          </h2>
          <p className="card-subtitle">
            {manualChecks.length} manual checks for verification
          </p>
        </div>
        <svg
          className="check-expand"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-tertiary)"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div id={contentId} className="mt-6 space-y-6">
          {Object.entries(groupedChecks)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([level, checks]) => (
              <div key={level}>
                <h3
                  className="text-sm font-semibold uppercase tracking-wider mb-3"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Level {level}: {levelNames[Number(level)]}
                </h3>
                <ul className="space-y-2">
                  {checks.map((check, i) => (
                    <li
                      key={check.id}
                      className="p-4 rounded-lg animate-slide-in"
                      style={{
                        background: "var(--color-bg-tertiary)",
                        border: "1px solid var(--border-subtle)",
                        animationDelay: `${i * 30}ms`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span style={{ color: "var(--text-tertiary)" }}>☐</span>
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
