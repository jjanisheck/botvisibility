"use client";

import { ChecklistItem as ChecklistItemType } from "@/data/checklist";

interface Props {
  item: ChecklistItemType;
  checked: boolean;
  onToggle: (id: string) => void;
}

export function ChecklistItem({ item, checked, onToggle }: Props) {
  return (
    <label
      className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
        checked
          ? "bg-green-900/20 border-green-500/50"
          : "bg-zinc-900/50 border-zinc-700 hover:border-zinc-600"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(item.id)}
        className="mt-1 w-5 h-5 rounded border-zinc-600 bg-zinc-800 text-green-500 focus:ring-green-500 focus:ring-offset-0 cursor-pointer"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-zinc-500">{item.id}</span>
          <span className="font-medium text-zinc-100">{item.title}</span>
        </div>
        <p className="text-sm text-zinc-400 mt-1">{item.description}</p>
      </div>
    </label>
  );
}
