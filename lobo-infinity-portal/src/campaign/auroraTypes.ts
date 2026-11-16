export type AuroraTerritoryState = { id: string; controller: string; vulnerable: boolean; ruin: boolean; infiltrated: boolean }
export type AuroraPublicState = {
  campaignRevision?: '2026-11-15-audit'; selectionDeadline?: string;
  ownerAdvantages?: { status: 'pending' | 'locked'; active: string[]; owners: Record<string, string> };
  nominationHistory?: Array<{ turn: number; faction: string; territory: string }>;
  finalStandings?: Array<{ faction: string; vp: number; tp: number; op: number; rank: number }>;
  rulesRevision?: 'legacy' | '2026-11-balance'; tiePriority?: string[];
  schemaVersion: 1; eventId: string; turn: number; deadline: string; reportUrl: string;
  campaignEvent: { title: string; rules: string } | null;
  narrativeMission: { title: string; briefing: string; reward: string; sheetUrl: string } | null;
  territories: AuroraTerritoryState[]; standings: Array<{ faction: string; vp: number }>;
  totals: Array<{ location: string; faction: string; tp: number; op: number }>;
  story: Array<{ turn: number; title: string; body: string }>;
}
export type AuroraPublication = { revision: string; publishedAt: string; state: AuroraPublicState }
