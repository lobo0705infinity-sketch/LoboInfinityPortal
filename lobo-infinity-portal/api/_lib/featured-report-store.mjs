import { get, put } from '@vercel/blob'

const pathname = 'portal-config/featured-report.json'

export async function readFeaturedReportPin({ getObject = get } = {}) {
  const blob = await getObject(pathname, { access: 'public', useCache: false })
  if (!blob) return null
  const data = await new Response(blob.stream).json()
  if (data?.version !== 1 || (data.pinnedId !== null && !isValidReportId(data.pinnedId))) {
    throw new Error('Invalid featured report configuration')
  }
  return data.pinnedId
}

export async function writeFeaturedReportPin(pinnedId, { putObject = put } = {}) {
  if (pinnedId !== null && !isValidReportId(pinnedId)) throw new Error('Invalid report ID')
  await putObject(pathname, JSON.stringify({ version: 1, pinnedId }), {
    access: 'public', allowOverwrite: true, cacheControlMaxAge: 60,
    contentType: 'application/json; charset=utf-8', addRandomSuffix: false,
  })
  return pinnedId
}

export function isValidReportId(value) {
  return Number.isSafeInteger(value) && value > 0
}
