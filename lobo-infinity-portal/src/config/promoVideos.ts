export const LOBO_YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/@LoboInfinity'
export const AURORA_TRAILER_ID = 'KM4ImgwPNBk'

export const AURORA_FACTION_PROMOS = [
  { faction: 'Tohaa', videoId: '6UEQcIXFs_U' },
  { faction: 'NA2', videoId: 'pmsidzO0OwY' },
  { faction: 'Combined Army', videoId: 'vwVwHJNByLQ' },
  { faction: 'Haqqislam', videoId: 'VKBL-obKj_c' },
  { faction: 'ALEPH', videoId: 'KI7-aQBId94' },
  { faction: 'JSA', videoId: 'c_lksFUkuZU' },
  { faction: 'O-12', videoId: '0tGKy9kXQWs' },
  { faction: 'PanOceania', videoId: '4uGNySkV5fs' },
  { faction: 'Nomads', videoId: 'NS-ozkIHKfw' },
  { faction: 'Yu Jing', videoId: 'af3Td7kCm_c' },
  { faction: 'Ariadna', videoId: 'jbE21JYP2dE' },
]

export function youtubeWatchUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`
}
