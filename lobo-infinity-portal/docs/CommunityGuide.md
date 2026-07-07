# Community Guide

## League Personality

Version 4.4 makes the portal feel more like the home of the league while preserving existing architecture.

The Dashboard now includes:

- Dynamic hero copy based on real player or league state.
- League headlines from submitted games, achievements, commissioner news, progress, and promotion status.
- Featured match cards from accepted scheduled matches, recommended remaining opponents, or recent battles.
- A season story timeline generated from current week, latest result, commissioner news, and progress.
- Record and community spotlight cards.
- A Rivalry Room built from repeated submitted head-to-head games.

## Data Rules

League Personality must only use existing league data.

It may use:

- Community Command Center.
- Match scheduling requests.
- Recent games.
- Commissioner news.
- Achievements and notifications.
- Season progress.
- Promotion status.

It must not invent:

- Streaks.
- Records.
- Rivalries.
- Promotion outcomes.
- Availability overlap.
- Game results.

If the data does not exist, the portal should omit that story or show a clear empty state.

## Rivalries

The Rivalry Room uses submitted game history. A matchup is considered meaningful only when repeated head-to-head games exist in the loaded game feed.

Rivalry cards show:

- Head-to-head record.
- Tournament Points.
- Objective Points.
- Victory Points.
- Average VP margin.
- Recent meetings.

Rivalry data is presentation-only. It does not change standings, achievements, notifications, or scheduling recommendations.
