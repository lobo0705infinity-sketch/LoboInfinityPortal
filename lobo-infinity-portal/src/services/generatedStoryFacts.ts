import type { GameStoryTemplate } from './gameStoryTemplate.ts'

// The public game supplies an overall result, not a ledger of objective
// activations, item transfers, or exact positions during play. Scene facts
// describe only the fictional incident selected by the generator.
export type ObjectiveEvidence = 'aggregate-only'
export type IncidentSceneFacts = {
  item?: { name: 'Quantum Core' | 'ID Token'; possession: 'unclaimed' | 'carried' }
  site?: 'prototype-wreck' | 'prototype-lift' | 'prototype-cradle'
}

export function assertGeneratedStoryFacts(
  story: GameStoryTemplate,
  evidence: ObjectiveEvidence,
  facts?: IncidentSceneFacts,
): void {
  if (evidence !== 'aggregate-only') throw new Error('Unknown game-story objective evidence')
  const endings = Object.values(story.endings).join(' ')
  if (/\b(?:activated|analy[sz]ed|neutralized|extracted|captured|hacked|dominated|scanned|stabilized|destroyed)\b/i.test(endings) ||
    /\bcontrolled\s+(?:(?:the|a|an|its|their|enemy|rival|disputed)\s+){0,3}(?:objective|antenna|relay|switch|panel|zone|area|console|beacon|core|prototype)\b/i.test(endings)) {
    throw new Error(`${story.mission}: an ending asserts an objective absent from the game feed`)
  }
  if (story.mission === 'Area of Interest' &&
    /\b(?:secured|seized|held|captured|claimed|took|controlled|won)\s+(?:(?:the|its|an?|both|disputed|nearest|enemy|rival|communication|relay|antenna|control|command|access)\s+){0,3}(?:switch|relay|antenna|mast|panel|controls|command record|signal)\b|\bcontrol of (?:the|a|its) (?:switch|relay|antenna|mast|panel|controls)\b/i.test(endings)) {
    throw new Error('Area of Interest: unverified objective control in ending')
  }
  if (facts?.item?.possession === 'unclaimed') {
    // An earlier bearer or a hypothetical *next* bearer may occur in the
    // opening. Once the incident starts, it has no current item bearer.
    const unresolved = [...story.paragraphs.slice(1), ...Object.values(story.endings)].join(' ')
    const bearer = facts.item.name === 'Quantum Core'
      ? /\b(?:the|its|slow|wounded|quantum core|core)\s+bearer\b/i
      : /\b(?:the|its|wounded|id token|id)\s+bearer\b/i
    if (bearer.test(unresolved)) {
      throw new Error(`${story.mission}: unclaimed ${facts.item.name} has a bearer`)
    }
  }
  if (facts?.site === 'prototype-wreck' &&
    /\bcradle\b/i.test([...story.paragraphs, ...Object.values(story.endings)].join(' '))) {
    throw new Error(`${story.mission}: prototype-wreck scene moved the crate to a cradle`)
  }
  if (facts?.site === 'prototype-lift' &&
    /\bcradle\b/i.test([...story.paragraphs.slice(1), ...Object.values(story.endings)].join(' '))) {
    throw new Error(`${story.mission}: prototype-lift scene returned the moving device to its cradle`)
  }
}
