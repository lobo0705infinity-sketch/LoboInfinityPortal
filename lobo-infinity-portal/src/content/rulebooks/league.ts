import type { Rulebook } from './types'

export const leagueRulebook: Rulebook = {
  description: 'July 2026 Season official rules reference',
  eventType: 'League Reference',
  id: 'league',
  title: 'The Lobo Infinity League',
  sections: [
    {
      id: 'league-structure',
      title: '1. League Structure',
      body: [
        {
          text: 'The league is divided into two competitive tiers designed to create constant pressure, movement, and rivalry.',
          type: 'paragraph',
        },
      ],
    },
    {
      id: 'main-man',
      title: '2. The Main Man Division',
      kicker: '"The Galaxy\'s Elite Operators"',
      body: [
        {
          text: 'The Main Man Division contains the 10 strongest and highest-performing players in the league.',
          type: 'paragraph',
        },
      ],
    },
    {
      id: 'proving-grounds',
      title: '3. The Proving Grounds',
      kicker: '"Earn Your Seat at the Table"',
      body: [
        {
          text: 'There will be multiple Proving Grounds divisions as needed:',
          type: 'paragraph',
        },
        {
          items: ['Proving Grounds A', 'Proving Grounds B', 'Proving Grounds C'],
          type: 'unordered',
        },
        {
          text: 'Each division contains up to 10 players.',
          type: 'paragraph',
        },
      ],
    },
    {
      id: 'season-structure',
      title: '4. Season Structure',
      body: [
        { text: 'The league operates with:', type: 'paragraph' },
        { items: ['2 Seasons Per Year', '20 Weeks Per Season'], type: 'unordered' },
        {
          text: 'Every player must complete 9 games by the end of the season, one game against each of their division rivals.',
          type: 'paragraph',
        },
        {
          text: 'Players must complete 5 games by the halfway point of the season and the remaining 4 games by the end of the season.',
          type: 'paragraph',
        },
        {
          text: 'Players are not limited to one game per week. If you and your opponents can make it work, you may play multiple games in a week, provided you complete 5 games by mid-season and all 9 games by the end of the season.',
          type: 'paragraph',
        },
      ],
    },
    {
      id: 'event-format',
      title: '5. Event Format',
      body: [
        {
          text: 'Each official event uses the standard Infinity Tournament System (ITS) structure.',
          type: 'paragraph',
        },
        { text: 'Standings are determined using:', type: 'paragraph' },
        {
          items: ['Tournament Points', 'Objective Points', 'Victory Points'],
          type: 'unordered',
        },
      ],
    },
    {
      id: 'list-submission',
      title: '6. List Submission Rules',
      body: [
        { text: 'Players are not locked to any one specific list.', type: 'paragraph' },
        {
          text: 'Lists may be changed between games, allowing players to adapt, experiment, and prepare for different opponents and missions.',
          type: 'paragraph',
        },
      ],
    },
    {
      id: 'mission-selection',
      title: '7. Mission Selection',
      body: [
        {
          text: 'The 20-week season is broken down into ten 2-week periods.',
          type: 'paragraph',
        },
        { text: 'Each 2-week period will have:', type: 'paragraph' },
        { items: ['Two eligible missions', 'Two eligible maps'], type: 'unordered' },
        { text: 'Once you and your opponent sit down to play:', type: 'paragraph' },
        {
          items: [
            'Both players roll a die.',
            'The player with the higher roll chooses which eligible mission will be played.',
            'The player with the lower roll chooses which eligible map will be used.',
            'Players then select Classified Cards and then select which list they will use. Both players put two copies of their miniatures on the table in Tabletop Simulator in their respective bags/boxes, and then roll for Initiative.',
            "One copy of each player's army is put off to the side. Then both players announce which army they are playing.",
            'At the end of the game, opponents may check the bag on the side if they have any questions about the list.',
          ],
          type: 'ordered',
        },
      ],
    },
    {
      id: 'league-philosophy',
      title: '8. League Philosophy',
      body: [
        { text: 'The league is designed to create:', type: 'paragraph' },
        {
          items: [
            'Constant competitive pressure',
            'Meaningful rankings',
            'High-stakes matches',
            'Seasonal storylines',
            'Rivalries and redemption arcs',
          ],
          type: 'unordered',
        },
      ],
    },
    {
      id: 'promotion-relegation',
      title: '9. Promotion & Relegation',
      body: [
        {
          text: 'At the conclusion of every official league season, players move between divisions based on their final standings.',
          type: 'paragraph',
        },
        {
          children: [
            {
              items: [
                'The bottom two (2) players are automatically relegated to Proving Grounds A.',
              ],
              type: 'unordered',
            },
          ],
          title: 'Main Man Division',
          type: 'subsection',
        },
        {
          children: [
            {
              items: [
                'The top two (2) players are automatically promoted to the Main Man Division.',
                'The bottom two (2) players are automatically relegated to Proving Grounds B.',
              ],
              type: 'unordered',
            },
          ],
          title: 'Proving Grounds A',
          type: 'subsection',
        },
        {
          children: [
            {
              items: [
                'The top two (2) players are automatically promoted to Proving Grounds A.',
              ],
              type: 'unordered',
            },
          ],
          title: 'Proving Grounds B',
          type: 'subsection',
        },
        {
          children: [
            {
              text: 'If additional Proving Grounds divisions are created, promotion and relegation continue between adjacent divisions.',
              type: 'paragraph',
            },
            { text: 'For example:', type: 'paragraph' },
            {
              items: [
                'Top two from Proving Grounds C are promoted to Proving Grounds B.',
                'Bottom two from Proving Grounds B are relegated to Proving Grounds C.',
              ],
              type: 'unordered',
            },
            {
              text: 'This structure continues for any future divisions created by the League Organizer.',
              type: 'paragraph',
            },
          ],
          title: 'Additional Proving Grounds Divisions',
          type: 'subsection',
        },
        {
          children: [
            {
              items: [
                'Promotion and relegation are automatic.',
                'No promotion playoffs or challenge matches are used.',
                'Final standings are determined using official Infinity ITS tiebreakers.',
                'If a player withdraws from the league or a vacancy occurs, the League Organizer may adjust promotions to preserve balanced divisions.',
              ],
              type: 'unordered',
            },
          ],
          title: 'General Rules',
          type: 'subsection',
        },
        {
          text: 'Every season offers players the opportunity to climb the league ladder or risk falling down it. Every game matters.',
          type: 'paragraph',
        },
      ],
    },
  ],
}

export default leagueRulebook
