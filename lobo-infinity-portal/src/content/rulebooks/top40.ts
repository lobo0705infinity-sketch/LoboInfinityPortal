import type { Rulebook } from './types'

export const top40Rulebook: Rulebook = {
  description: 'Lobo’s American Top 40 is an individual, 300-point, double-elimination Infinity tournament open to players throughout the Americas. Players are eliminated after their second match loss.',
  eventType: 'Individual Tournament Rules',
  id: 'top-40',
  title: 'Lobo’s American Top 40 Rules',
  sections: [
    { id: 'eligibility-and-field', title: '1. Eligibility and Field', body: [{ type: 'unordered', items: ['The tournament is open to players throughout the Americas.', 'The field is limited to a maximum of 40 players.'] }] },
    { id: 'tournament-format-and-seeding', title: '2. Tournament Format and Seeding', body: [{ type: 'unordered', items: ['The tournament uses an individual double-elimination format.', 'Players are manually seeded using Corvus Belli rankings.', 'A player is eliminated after their second match loss.'] }] },
    { id: 'army-points', title: '3. Army Points', body: [{ type: 'paragraph', text: 'Every match is played at 300 points.' }] },
    { id: 'army-lists', title: '4. Army Lists', body: [{ type: 'unordered', items: ['Players choose the army list they will use at the time of each game.', 'Players are not required to lock one specific list for the entire tournament unless the Tournament Organizer announces an additional requirement before the event begins.'] }] },
    { id: 'missions', title: '5. Missions', body: [{ type: 'unordered', items: ['The complete mission pool will be published before the tournament begins.', 'Players must use the assigned mission for each match or bracket round.'] }] },
    { id: 'match-scheduling', title: '6. Match Scheduling', body: [{ type: 'unordered', items: ['Once a match becomes active, both players receive at least seven full days to schedule and complete it.', 'Players are expected to communicate promptly and make a good-faith effort to arrange their match.'] }] },
    { id: 'reporting-results-and-draws', title: '7. Reporting Results and Draws', body: [{ type: 'unordered', items: ['Players must report the match result using the portal’s established result-reporting process.', 'If a match ends in a draw, the winner is determined by Victory Points.', 'If Victory Points are also tied, the Tournament Organizer will issue the final ruling.'] }] },
    { id: 'defaults-and-forfeits', title: '8. Defaults and Forfeits', body: [{ type: 'unordered', items: ['The Tournament Organizer or GM will handle defaults, forfeits, missed deadlines, unresponsive players, and scheduling disputes.', 'The Tournament Organizer’s ruling on defaults and forfeits is final.'] }] },
  ],
}

export default top40Rulebook
