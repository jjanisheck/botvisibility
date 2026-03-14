"use client";

import { Level } from "@/data/checklist";
import { ChecklistItem } from "./ChecklistItem";

interface Props {
  level: Level;
  checkedItems: Set<string>;
  onToggle: (id: string) => void;
}

export function LevelSection({ level, checkedItems, onToggle }: Props) {
  const checkedCount = level.items.filter((item) => checkedItems.has(item.id)).length;
  const percentage = Math.round((checkedCount / level.items.length) * 100);

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-100">
            Level {level.id}: {level.name}
          </h2>
          <p className="text-sm text-zinc-400">{level.subtitle}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-zinc-100">
            {checkedCount}/{level.items.length}
          </div>
          <div className="text-sm text-zinc-500">{percentage}%</div>
        </div>
      </div>
      <div className="w-full h-2 bg-zinc-800 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="space-y-2">
        {level.items.map((item) => (
          <ChecklistItem
            key={item.id}
            item={item}
            checked={checkedItems.has(item.id)}
            onToggle={onToggle}
          />
        ))}
      </div>
    </section>
  );
}
