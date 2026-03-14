import { Tier } from './types.js';

// BotVisibility tier definitions
export function getTier(score: number, maxScore: number = 9): Tier {
  const percentage = (score / maxScore) * 100;

  if (percentage <= 20) {
    return {
      name: 'Invisible',
      emoji: '🔴',
      color: 'red',
      description: "Bots can't see you. Zero visibility to AI agents.",
      range: '0-20%'
    };
  }
  if (percentage <= 40) {
    return {
      name: 'Dim',
      emoji: '🟠',
      color: 'orange',
      description: "Bots know you exist but can barely use you.",
      range: '21-40%'
    };
  }
  if (percentage <= 62) {
    return {
      name: 'Visible',
      emoji: '🟡',
      color: 'yellow',
      description: "Bots can find you and handle basic tasks.",
      range: '41-62%'
    };
  }
  if (percentage <= 80) {
    return {
      name: 'Clear',
      emoji: '🟢',
      color: 'green',
      description: "Bots see you clearly. Ahead of most of the internet.",
      range: '63-80%'
    };
  }
  return {
    name: 'Beacon',
    emoji: '🚀',
    color: 'purple',
    description: "Maximum bot visibility. Agents find you, understand you, prefer you.",
    range: '81-100%'
  };
}
