export type ArmyStoryStyle = 'assault' | 'armored' | 'flanking' | 'guard' | 'rescue' | 'covert' | 'technical' | 'contract'

export type ArmyStoryVoice = {
  crew: string
  style: ArmyStoryStyle
}

// Fictional crew descriptions and broad tactics, never assertions that a
// particular unit was in a submitted list. Mission frames supply the terrain.
export const ARMY_STORY_VOICES: Record<string, ArmyStoryVoice> = {
  'panoceania': {
    crew: 'armored survey troops',
    style: 'technical',
  },
  'military-orders': {
    crew: 'armored knights',
    style: 'armored',
  },
  'kestrel-colonial-force': {
    crew: 'colonial scouts',
    style: 'flanking',
  },
  'neoterra-capitaline-army': {
    crew: 'capital security troops',
    style: 'guard',
  },
  'shock-army-of-acontecimento': {
    crew: 'jungle campaign veterans',
    style: 'flanking',
  },
  'svalarheima-winter-force': {
    crew: 'winter patrol fighters',
    style: 'flanking',
  },
  'varuna-immediate-reaction-division': {
    crew: 'rapid-response marines',
    style: 'rescue',
  },
  'yu-jing': {
    crew: 'disciplined assault teams',
    style: 'armored',
  },
  'imperial-service': {
    crew: 'imperial investigators',
    style: 'technical',
  },
  'invincible-army': {
    crew: 'heavy infantry columns',
    style: 'armored',
  },
  'white-banner': {
    crew: 'mountain-trained patrols',
    style: 'flanking',
  },
  'ariadna': {
    crew: 'frontier patrols',
    style: 'covert',
  },
  'caledonian-highlander-army': {
    crew: 'highland fighters',
    style: 'assault',
  },
  'force-de-reponse-rapide-merovingienne': {
    crew: 'Merovingian response teams',
    style: 'flanking',
  },
  'kosmoflot': {
    crew: 'cold-weather raiders',
    style: 'flanking',
  },
  'tartary-army-corps': {
    crew: 'Tartary veterans',
    style: 'guard',
  },
  'usariadna-ranger-force': {
    crew: 'ranger patrols',
    style: 'flanking',
  },
  'haqqislam': {
    crew: 'field medics and escorts',
    style: 'rescue',
  },
  'hassassin-bahram': {
    crew: 'masked infiltrators',
    style: 'covert',
  },
  'qapu-khalqi': {
    crew: 'port security contractors',
    style: 'contract',
  },
  'ramah-taskforce': {
    crew: 'rescue-trained assault troops',
    style: 'rescue',
  },
  'nomads': {
    crew: 'nomad field operators',
    style: 'technical',
  },
  'bakunin-jurisdictional-command': {
    crew: 'Bakunin operatives',
    style: 'covert',
  },
  'corregidor-jurisdictional-command': {
    crew: 'shipyard-hardened crews',
    style: 'guard',
  },
  'tunguska-jurisdictional-command': {
    crew: 'network security teams',
    style: 'technical',
  },
  'combined-army': {
    crew: 'alien assault troops',
    style: 'assault',
  },
  'morat-aggression-force': {
    crew: 'Morat shock fighters',
    style: 'assault',
  },
  'next-wave': {
    crew: 'Next Wave raiders',
    style: 'covert',
  },
  'onyx-contact-force': {
    crew: 'Onyx assault teams',
    style: 'armored',
  },
  'shasvastii-expeditionary-force': {
    crew: 'concealed expeditionary scouts',
    style: 'covert',
  },
  'aleph': {
    crew: 'algorithm-guided teams',
    style: 'technical',
  },
  'operations-subsection': {
    crew: 'subsection operatives',
    style: 'technical',
  },
  'steel-phalanx': {
    crew: 'phalanx veterans',
    style: 'armored',
  },
  'o-12': {
    crew: 'international security officers',
    style: 'guard',
  },
  'starmada': {
    crew: 'fleet security teams',
    style: 'rescue',
  },
  'torchlight-brigade': {
    crew: 'brigade responders',
    style: 'rescue',
  },
  'japanese-secessionist-army': {
    crew: 'secessionist fighters',
    style: 'assault',
  },
  'oban': {
    crew: 'Oban patrols',
    style: 'flanking',
  },
  'shindenbutai': {
    crew: 'Shindenbutai fighters',
    style: 'flanking',
  },
  'tohaa': {
    crew: 'Tohaa envoys and guards',
    style: 'rescue',
  },
  'dashat-company': {
    crew: 'Dashat hired guns',
    style: 'contract',
  },
  'druze-bayram-security': {
    crew: 'Druze contract fighters',
    style: 'contract',
  },
  'ikari-company': {
    crew: 'Ikari mercenaries',
    style: 'assault',
  },
  'starco': {
    crew: 'StarCo retrieval teams',
    style: 'contract',
  },
  'white-company': {
    crew: 'White Company contractors',
    style: 'guard',
  },
}
