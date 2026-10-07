import { ApplicationCommandOptionType } from 'discord.js'
import { readFile } from 'node:fs/promises'

export const KILL_COMMAND_DEFINITION = Object.freeze({
  name: 'kill',
  description: 'Give Lobo a spectacularly dramatic exit',
  options: [{ name: 'lobo', description: 'Tell everyone he died cool', type: ApplicationCommandOptionType.Subcommand }],
})
export const LOBO_DEATH_GIF = new URL('./assets/lobo-dramatic-death.gif', import.meta.url)
export const LOBO_DEATH_CAPTION = 'TELL EVERYONE I DIED COOL.'

export function createKillInteractionHandler({ loadGif = () => readFile(LOBO_DEATH_GIF), logger = console } = {}) {
  return async interaction => {
    if (!interaction.isChatInputCommand?.() || interaction.commandName !== 'kill'
      || interaction.options.getSubcommand(false) !== 'lobo') return false
    try {
      await interaction.deferReply()
      const gif = await loadGif()
      await interaction.editReply({
        content: `**${LOBO_DEATH_CAPTION}**`,
        files: [{ attachment: gif, name: 'lobo-dramatic-death.gif' }],
        allowedMentions: { parse: [] },
      })
    } catch (error) {
      logger.error?.('Lobo death GIF failed:', error.message)
      try {
        const payload = { content: 'Even Death is having technical difficulties. Try `/kill lobo` again.', allowedMentions: { parse: [] } }
        if (interaction.deferred || interaction.replied) await interaction.editReply(payload)
        else await interaction.reply({ ...payload, flags: 64 })
      } catch {}
    }
    return true
  }
}
