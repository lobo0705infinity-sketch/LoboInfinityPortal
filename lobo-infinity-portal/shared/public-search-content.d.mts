export type PublicSearchPage = {
  pathname: string
  canonicalPath: string
  title: string
  description: string
  heading: string
  intro: string
  links: Array<{ label: string; href: string }>
  image?: string
  imageAlt?: string
}

export function publicDatasetForPath(pathname: string): 'games' | 'events' | 'factions' | 'missions' | null
export function describePublicSearchPage(pathname: string, datasets?: Record<string, unknown[] | number | null>): PublicSearchPage | null
export const SITE_ORIGIN: string
