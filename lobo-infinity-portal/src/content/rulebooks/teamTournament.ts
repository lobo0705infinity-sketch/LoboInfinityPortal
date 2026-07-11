import type { Rulebook } from './types'

export const teamTournamentRulebook: Rulebook = {
  description: '"This is a casual event. Have fun and don\'t be sweaty!"',
  eventType: 'Team Tournament Reference',
  id: 'team-tournament',
  subtitle: 'Survive the Ride',
  title: "LOBO'S INFINITY TEAM TOURNAMENT",
  sections: [
    {
      id: 'team-composition',
      title: '1. Team Composition',
      body: [
        { text: 'Players form teams of four (4).', type: 'paragraph' },
        {
          text: 'After registration closes, the Tournament Organizer assigns a fifth player from the pool of unassigned players to each team.',
          type: 'paragraph',
        },
        {
          text: 'All tournament teams compete as five-player teams.',
          type: 'paragraph',
        },
        {
          text: 'Each team designates one Team Captain responsible for pairing decisions.',
          type: 'paragraph',
        },
      ],
    },
    {
      id: 'army-list-submission',
      title: '2. Army List Submission',
      body: [
        {
          text: 'Each player may submit up to two (2) legal Infinity army lists.',
          type: 'paragraph',
        },
        {
          text: 'Players may freely choose either submitted list each round, subject to ITS and event restrictions.',
          type: 'paragraph',
        },
      ],
    },
    {
      id: 'faction-restrictions',
      title: '3. Faction Restrictions',
      body: [
        {
          text: 'No two players on the same team may use the same exact Vanilla faction or Sectorial.',
          type: 'paragraph',
        },
        { text: 'Examples of legal combinations include:', type: 'paragraph' },
        {
          items: [
            'Vanilla PanOceania + Military Orders',
            'Starmada + Operations Subsection',
            'Onyx Contact Force + Morat Aggression Force',
          ],
          type: 'unordered',
        },
        {
          text: 'The Tournament Organizer has final authority regarding faction eligibility and roster legality.',
          type: 'paragraph',
        },
      ],
    },
    {
      id: 'game-scoring',
      title: '4. Game Scoring',
      body: [
        {
          text: 'Individual games use the standard Infinity Tournament System (ITS).',
          type: 'paragraph',
        },
        { text: 'Each game records:', type: 'paragraph' },
        {
          items: ['Objective Points (OP)', 'Tournament Points (TP)', 'Victory Points (VP)'],
          type: 'unordered',
        },
      ],
    },
    {
      id: 'team-pairings',
      title: '5. Team Pairings',
      body: [
        { text: 'Each round consists of five individual games.', type: 'paragraph' },
        {
          children: [
            {
              text: 'Both captains secretly select and reveal one Defender.',
              type: 'paragraph',
            },
          ],
          title: 'Step 1',
          type: 'subsection',
        },
        {
          children: [
            {
              text: 'Each captain offers two Attackers from their remaining players.',
              type: 'paragraph',
            },
          ],
          title: 'Step 2',
          type: 'subsection',
        },
        {
          children: [
            {
              text: 'Each captain selects one offered Attacker to face their Defender.',
              type: 'paragraph',
            },
            {
              text: 'The unused Attacker returns to the available pool.',
              type: 'paragraph',
            },
          ],
          title: 'Step 3',
          type: 'subsection',
        },
        {
          children: [
            {
              text: 'Repeat until only one player remains on each team.',
              type: 'paragraph',
            },
          ],
          title: 'Step 4',
          type: 'subsection',
        },
        {
          children: [
            {
              text: 'The remaining players are automatically paired.',
              type: 'paragraph',
            },
          ],
          title: 'Step 5',
          type: 'subsection',
        },
      ],
    },
    {
      id: 'team-scoring',
      title: '6. Team Scoring',
      body: [
        {
          text: "After all five games combine each team's scores.",
          type: 'paragraph',
        },
        { text: 'Primary tiebreak order:', type: 'paragraph' },
        {
          items: [
            'Highest Objective Points (OP)',
            'Highest Tournament Points (TP)',
            'Highest Victory Points (VP)',
          ],
          type: 'ordered',
        },
        {
          text: 'Objective Points are the primary measure of team success.',
          type: 'paragraph',
        },
      ],
    },
    {
      id: 'sportsmanship',
      title: '7. Sportsmanship',
      body: [
        { text: 'Play in good faith.', type: 'paragraph' },
        { text: 'Follow current ITS rules.', type: 'paragraph' },
        { text: 'Resolve disputes respectfully.', type: 'paragraph' },
        { text: 'Maintain a welcoming environment.', type: 'paragraph' },
        {
          text: 'Represent your team and the Infinity community with sportsmanship and respect.',
          type: 'paragraph',
        },
      ],
    },
    {
      id: 'event-motto',
      title: 'Event Motto',
      body: [
        { text: 'Your team rides together.', type: 'paragraph' },
        { text: 'Your team dies together.', type: 'paragraph' },
        { text: 'Only one team leaves as the Main Men.', type: 'paragraph' },
      ],
    },
  ],
}

export default teamTournamentRulebook
