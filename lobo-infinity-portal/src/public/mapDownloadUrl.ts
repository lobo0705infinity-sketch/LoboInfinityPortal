import current from '../../shared/lobo-workshop-current.json'

export function mapDownloadUrl(path: string) {
  if (!path.startsWith('/assets/maps/')) return path
  const url = new URL(path, 'https://lobo-infinity-portal.vercel.app')
  url.searchParams.set('v', current.downloadRevision)
  return url.pathname + url.search + url.hash
}
