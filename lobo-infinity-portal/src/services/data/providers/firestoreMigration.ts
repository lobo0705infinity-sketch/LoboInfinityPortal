import type { DataProvider } from '../DataProvider'

export type FirestoreMigrationResult = {
  events: number
  registrations: number
  teams: number
  pairings: number
  warnings: string[]
}

export async function migrateGoogleProviderToFirestore(
  googleProvider: DataProvider,
  firestoreProvider: DataProvider,
): Promise<FirestoreMigrationResult> {
  const warnings: string[] = []
  const catalog = await googleProvider.events.getEvents()
  let registrations = 0
  let teams = 0
  let pairings = 0

  for (const event of catalog.events) {
    await firestoreProvider.events.saveEvent({
      description: event.description,
      endDate: event.endDate,
      eventId: event.id,
      lifecycleStage: event.lifecycleStage,
      name: event.name,
      registration: event.registration,
      rules: event.rules,
      scoringModel: event.scoringModel,
      standingsModel: event.standingsModel,
      startDate: event.startDate,
      status: event.status,
      type: event.type,
    })

    const registration = await googleProvider.registrations
      .getRegistration(event.id)
      .catch((error: unknown) => {
        warnings.push(
          `Registration migration skipped for ${event.id}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        )
        return null
      })

    if (registration) {
      for (const entry of registration.registrations) {
        await firestoreProvider.registrations.manage({
          captain: String(entry.captain),
          discord: entry.discord,
          displayName: entry.displayName,
          email: entry.email,
          eventId: entry.eventId,
          faction: entry.faction,
          freeAgent: String(entry.freeAgent),
          notes: entry.notes,
          player: entry.player,
          preferredTeam: entry.preferredTeam,
          registeredAt: entry.registeredAt,
          role: entry.role,
          seed: entry.seed,
          status: entry.status,
          team: entry.team,
        })
        registrations += 1
      }
    }

    if (event.type === 'Team Tournament') {
      const tournament = await googleProvider.teams
        .getTeamTournament(event.id)
        .catch((error: unknown) => {
          warnings.push(
            `Team Tournament migration skipped for ${event.id}: ${
              error instanceof Error ? error.message : 'unknown error'
            }`,
          )
          return null
        })

      if (tournament) {
        for (const team of tournament.teams) {
          await firestoreProvider.teams.saveTeam({
            captain: team.captain,
            discordContact: team.discordContact,
            eventId: team.eventId,
            factionRestrictions: team.factionRestrictions,
            logoUrl: team.logoUrl,
            players: team.players,
            status: team.status,
            teamId: team.teamId,
            teamName: team.teamName,
          })
          teams += 1
        }

        for (const pairing of tournament.pairings) {
          await firestoreProvider.teams.savePairing({
            eventId: pairing.eventId,
            playerPairings: pairing.playerPairings,
            results: pairing.results,
            round: pairing.round,
            roundId: pairing.roundId,
            status: pairing.status,
            teamA: pairing.teamA,
            teamB: pairing.teamB,
          })
          pairings += 1
        }
      }
    }
  }

  return {
    events: catalog.events.length,
    pairings,
    registrations,
    teams,
    warnings,
  }
}
