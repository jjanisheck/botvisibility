import { Tier } from './types.js';

// Tier definitions based on README scoring
export function getTier(score: number, maxScore: number = 9): Tier {
  const percentage = (score / maxScore) * 100;

  if (percentage <= 20) {
    return {
      name: 'Invisible',
      emoji: '🔴',
      color: 'red',
      description: "Agents can't find you or use you.",
      range: '0-20%'
    };
  }
  if (percentage <= 40) {
    return {
      name: 'Findable',
      emoji: '🟠',
      color: 'orange',
      description: "Agents know you exist but struggle to use you reliably.",
      range: '21-40%'
    };
  }
  if (percentage <= 62) {
    return {
      name: 'Usable',
      emoji: '🟡',
      color: 'yellow',
      description: "Agents can accomplish basic tasks. Rough edges remain.",
      range: '41-62%'
    };
  }
  if (percentage <= 80) {
    return {
      name: 'Ready',
      emoji: '🟢',
      color: 'green',
      description: "Agents can work with your app reliably.",
      range: '63-80%'
    };
  }
  return {
    name: 'Agent-Native',
    emoji: '🚀',
    color: 'purple',
    description: "Your app is designed for the agentic era.",
    range: '81-100%'
  };
}
