import type { Rulebook } from './types'

export const top40Rulebook: Rulebook = {
  description: 'Lobo’s Top 40 is an individual, 300-point, double-elimination Infinity tournament open to players throughout the Americas. Players are eliminated after their second match loss.',
  eventType: 'Individual Tournament Rules',
  id: 'top-40',
  title: 'Lobo’s Top 40 Rules',
  sections: [
    { id: 'eligibility-and-field', title: '1. Eligibility and Field', body: [{ type: 'unordered', items: ['The tournament is open to players throughout the Americas.', 'Registration is uncapped and may exceed 40 players.', 'After registration closes, the Commissioner selects the final tournament field.', 'The field is limited to a maximum of 40 players.'] }] },
    { id: 'tournament-format-and-seeding', title: '2. Tournament Format and Seeding', body: [{ type: 'unordered', items: ['The tournament uses an individual double-elimination format.', 'Players are seeded using Infinity the Meta ratings, with Commissioner placements for unrated players.', 'A player is eliminated after their second match loss.', 'If the Losers Bracket finalist wins the first Grand Final, a bracket reset is played. The second Grand Final decides the champion.'] }] },
    { id: 'army-points', title: '3. Army Points', body: [{ type: 'paragraph', text: 'Every match is played at 300 points.' }] },
    { id: 'army-lists', title: '4. Army Lists', body: [{ type: 'unordered', items: ['Players may change their army and army list between rounds.', 'Players are not required to use the same army or list throughout the tournament. Every list must stay within the 300-point limit.'] }] },
    { id: 'missions', title: '5. Missions', body: [{ type: 'unordered', items: ['The complete mission pool will be published before the tournament begins.', 'Players must use the assigned mission for each match or bracket round.'] }] },
    { id: 'match-scheduling', title: '6. Match Scheduling', body: [{ type: 'unordered', items: ['Once a match becomes active, both players receive at least seven full days to schedule and complete it.', 'Players are expected to communicate promptly and make a good-faith effort to arrange their match.'] }] },
    { id: 'reporting-results-and-draws', title: '7. Reporting Results and Draws', body: [{ type: 'unordered', items: ['Players must report the match result using the portal’s established result-reporting process.', 'If a match ends in a draw, the winner is determined by Victory Points.', 'If Victory Points are also tied, the Tournament Organizer will issue the final ruling.'] }] },
    { id: 'defaults-and-forfeits', title: '8. Defaults and Forfeits', body: [{ type: 'unordered', items: ['The Tournament Organizer or GM will handle defaults, forfeits, missed deadlines, unresponsive players, and scheduling disputes.', 'The Tournament Organizer’s ruling on defaults and forfeits is final.'] }] },
  ],
}

export default top40Rulebook
