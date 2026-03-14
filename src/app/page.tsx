"use client";

import { useState, useCallback } from "react";
import { CheckResult, ScanResult, ManualCheck, Tier } from "@/lib/types";

type ScanState = "idle" | "scanning" | "complete" | "error";

interface CheckingState {
  name: string;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [currentCheck, setCurrentCheck] = useState<CheckingState | null>(null);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [finalResult, setFinalResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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

      eventSource.addEventListener("start", () => {
        // Scan started
      });

      eventSource.addEventListener("checking", (event) => {
        const data = JSON.parse(event.data);
        setCurrentCheck({ name: data.name });
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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-16">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-3xl md:text-5xl font-bold mb-4">
            Agent-Readiness Scanner
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Check if your app is ready for AI agents. Scan any URL to see how
            discoverable, usable, and optimized it is for the agentic era.
          </p>
        </header>

        {/* URL Input Form */}
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex flex-col md:flex-row gap-3">
            <input
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1"
              disabled={scanState === "scanning"}
            />
            <button
              type="submit"
              disabled={scanState === "scanning" || !url.trim()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 rounded-lg font-medium transition-colors"
            >
              {scanState === "scanning" ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
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
                  Scanning...
                </span>
              ) : (
                "Scan URL"
              )}
            </button>
          </div>
        </form>

        {/* Error State */}
        {error && (
          <div className="mb-8 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Progress indicator */}
        {scanState === "scanning" && (
          <div className="mb-8">
            <div className="progress-bar mb-2">
              <div
                className="progress-bar-fill"
                style={{ width: `${(results.length / 9) * 100}%` }}
              />
            </div>
            {currentCheck && (
              <p className="text-sm text-zinc-400 animate-pulse">
                Checking {currentCheck.name}...
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
            <div className="bg-zinc-900 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4">
                Automated Checks ({results.filter((r) => r.passed).length}/
                {results.length} passed)
              </h2>
              <div className="space-y-3">
                {results.map((result) => (
                  <CheckResultCard key={result.id} result={result} />
                ))}
                {currentCheck && (
                  <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg animate-pulse">
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-blue-400 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
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
                    </div>
                    <span className="text-zinc-400">{currentCheck.name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Manual checks section */}
            {finalResult && (
              <ManualChecksSection manualChecks={finalResult.manualChecks} />
            )}
          </div>
        )}

        {/* Empty state */}
        {scanState === "idle" && results.length === 0 && (
          <div className="text-center py-12 text-zinc-500">
            <p className="text-lg mb-4">
              Enter a URL above to scan for agent-readiness
            </p>
            <p className="text-sm">
              We&apos;ll check for llms.txt, agent-card.json, OpenAPI specs, and
              more
            </p>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-zinc-800 text-center text-zinc-500 text-sm">
          <p>
            Based on the{" "}
            <a
              href="https://github.com/joeyjanisheck/agent-readiness-audit"
              className="text-zinc-300 hover:text-white transition-colors"
            >
              31-item Agent-Readiness Checklist
            </a>
            {" • "}
            Built by{" "}
            <a
              href="https://janisheck.com"
              className="text-zinc-300 hover:text-white transition-colors"
            >
              Joey Janisheck
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}

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
    <div className="bg-zinc-900 rounded-xl p-6 animate-slide-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">{tier.emoji}</span>
            <div>
              <h2 className={`text-2xl font-bold ${tierColorClass}`}>
                {tier.name}
              </h2>
              <p className="text-zinc-400 text-sm">{tier.range}</p>
            </div>
          </div>
          <p className="text-zinc-400">{tier.description}</p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold">
            {autoChecks}
            <span className="text-zinc-600">/{totalAutoChecks}</span>
          </div>
          <p className="text-zinc-500 text-sm">auto-detected</p>
          <p className="text-zinc-600 text-xs mt-1">
            {percentage}% toward full {maxScore}-item score
          </p>
        </div>
      </div>
    </div>
  );
}

function CheckResultCard({ result }: { result: CheckResult }) {
  const [expanded, setExpanded] = useState(false);

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

  const bgColorClass = {
    pass: "bg-green-900/20 border-green-800/30",
    fail: "bg-red-900/20 border-red-800/30",
    partial: "bg-yellow-900/20 border-yellow-800/30",
    unknown: "bg-zinc-800/50 border-zinc-700/30",
  }[result.status];

  return (
    <div
      className={`p-4 rounded-lg border ${bgColorClass} animate-slide-in cursor-pointer`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-3">
        <span className={`text-lg font-bold ${statusColorClass}`}>
          {statusIcon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{result.name}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
              Level {result.level}
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-1">{result.message}</p>

          {expanded && (
            <div className="mt-3 space-y-2 text-sm">
              {result.details && (
                <p className="text-zinc-500">{result.details}</p>
              )}
              {result.foundAt && (
                <p className="text-zinc-500">
                  Found at:{" "}
                  <a
                    href={result.foundAt}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {result.foundAt}
                  </a>
                </p>
              )}
              {result.recommendation && (
                <div className="p-3 bg-zinc-800 rounded-lg">
                  <p className="text-zinc-300">
                    <span className="font-medium">Recommendation:</span>{" "}
                    {result.recommendation}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        <span className="text-zinc-600 text-sm">{expanded ? "▲" : "▼"}</span>
      </div>
    </div>
  );
}

function ManualChecksSection({
  manualChecks,
}: {
  manualChecks: ManualCheck[];
}) {
  const [expanded, setExpanded] = useState(false);

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
    <div className="bg-zinc-900 rounded-xl p-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div>
          <h2 className="text-xl font-semibold">
            Complete Your Score ({manualChecks.length} manual checks)
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            These items require manual verification
          </p>
        </div>
        <span className="text-zinc-400">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="mt-6 space-y-6">
          {Object.entries(groupedChecks)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([level, checks]) => (
              <div key={level}>
                <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">
                  Level {level}: {levelNames[Number(level)]}
                </h3>
                <div className="space-y-2">
                  {checks.map((check) => (
                    <div
                      key={check.id}
                      className="p-3 bg-zinc-800/50 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500">☐</span>
                        <span className="font-medium">{check.name}</span>
                      </div>
                      <p className="text-sm text-zinc-400 mt-1 ml-6">
                        {check.description}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1 ml-6">
                        Why: {check.why}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
