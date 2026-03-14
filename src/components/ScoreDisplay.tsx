"use client";

import { getTier, totalItems, levels } from "@/data/checklist";

interface Props {
  checkedItems: Set<string>;
}

export function ScoreDisplay({ checkedItems }: Props) {
  const score = checkedItems.size;
  const percentage = Math.round((score / totalItems) * 100);
  const tier = getTier(score);

  const levelScores = levels.map((level) => ({
    level,
    checked: level.items.filter((item) => checkedItems.has(item.id)).length,
    total: level.items.length,
  }));

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 sticky top-4">
      <div className="text-center mb-6">
        <div className="text-6xl mb-2">{tier.emoji}</div>
        <h2 className={`text-2xl font-bold ${tier.color}`}>{tier.name}</h2>
        <p className="text-sm text-zinc-400 mt-1">{tier.description}</p>
      </div>

      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-zinc-400">Overall Score</span>
          <span className="font-bold text-zinc-100">
            {score}/{totalItems} ({percentage}%)
          </span>
        </div>
        <div className="w-full h-4 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <div className="space-y-3">
        {levelScores.map(({ level, checked, total }) => (
          <div key={level.id} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400">
              L{level.id}
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-300">{level.name}</span>
                <span className="text-zinc-500">
                  {checked}/{total}
                </span>
              </div>
              <div className="w-full h-1.5 bg-zinc-800 rounded-full mt-1 overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-300"
                  style={{ width: `${(checked / total) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-6 border-t border-zinc-700">
        <div className="text-xs text-zinc-500 mb-4 text-center">Score Tiers</div>
        <div className="grid grid-cols-5 gap-1 text-xs text-center">
          {[
            { range: "0-20%", emoji: "🔴" },
            { range: "21-40%", emoji: "🟠" },
            { range: "41-62%", emoji: "🟡" },
            { range: "63-80%", emoji: "🟢" },
            { range: "81-100%", emoji: "🚀" },
          ].map((t) => (
            <div key={t.range} className="flex flex-col items-center">
              <span className="text-lg">{t.emoji}</span>
              <span className="text-zinc-500 mt-1">{t.range}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
