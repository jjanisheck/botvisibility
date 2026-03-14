"use client";

import { useState, useEffect } from "react";
import { levels } from "@/data/checklist";
import { LevelSection } from "@/components/LevelSection";
import { ScoreDisplay } from "@/components/ScoreDisplay";
import { ExportButton } from "@/components/ExportButton";

export default function Home() {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Load from URL params
    const params = new URLSearchParams(window.location.search);
    const c = params.get("c");
    if (c) {
      setCheckedItems(new Set(c.split(",").filter(Boolean)));
    } else {
      // Load from localStorage
      const saved = localStorage.getItem("agent-readiness-audit");
      if (saved) {
        setCheckedItems(new Set(JSON.parse(saved)));
      }
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem("agent-readiness-audit", JSON.stringify(Array.from(checkedItems)));
    }
  }, [checkedItems, mounted]);

  const handleToggle = (id: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleReset = () => {
    if (confirm("Reset all progress? This cannot be undone.")) {
      setCheckedItems(new Set());
      localStorage.removeItem("agent-readiness-audit");
      window.history.replaceState({}, "", window.location.pathname);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            🤖 Agent-Readiness Audit
          </h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
            Is your app ready for the age of AI agents? Score yourself across 31 items
            and find out where you stand.
          </p>
        </header>

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Checklist */}
          <div className="lg:col-span-2 order-2 lg:order-1">
            {levels.map((level) => (
              <LevelSection
                key={level.id}
                level={level}
                checkedItems={checkedItems}
                onToggle={handleToggle}
              />
            ))}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 order-1 lg:order-2">
            <div className="space-y-4">
              <ScoreDisplay checkedItems={checkedItems} />
              <ExportButton checkedItems={checkedItems} />
              <button
                onClick={handleReset}
                className="w-full px-4 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Reset Progress
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-zinc-800 text-center text-zinc-500 text-sm">
          <p>
            Built by{" "}
            <a
              href="https://janisheck.com"
              className="text-zinc-300 hover:text-white transition-colors"
            >
              Joey Janisheck
            </a>
            {" • "}
            <a
              href="https://github.com/joeyjanisheck/agent-readiness-audit"
              className="text-zinc-300 hover:text-white transition-colors"
            >
              GitHub
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
