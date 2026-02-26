"use client";

import { AI_MODELS } from "@/hooks/usePuterAI";

export default function ModelSelector({ model, onModelChange }) {
  return (
    <select
      value={model}
      onChange={(e) => onModelChange(e.target.value)}
      className="input-base focus:input-focus appearance-none cursor-pointer text-xs py-1.5 px-2.5 pr-7 bg-neutral-800/50 border-white/8 rounded-lg"
    >
      {AI_MODELS.map((m) => (
        <option key={m.value} value={m.value}>
          {m.label}
        </option>
      ))}
    </select>
  );
}
