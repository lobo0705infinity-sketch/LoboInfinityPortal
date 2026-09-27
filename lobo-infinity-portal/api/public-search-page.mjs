import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describePublicSearchPage, publicDatasetForPath, SITE_ORIGIN } from '../shared/public-search-content.mjs'

const snapshotOrigin = 'https://ecwefvuvauaqpary.public.blob.vercel-storage.com/'
let templatePromise
let pointerCache

export default async function handler(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('allow', 'GET, HEAD')
    response.status(405).end()
    return
  }

  const pathname = String(request.query?.page || '').split('?')[0]
  if (!pathname.startsWith('/') || pathname.length > 300) {
    response.status(400).end('Invalid public page')
    return
  }

  const dataset = publicDatasetForPath(pathname)
  let data = {}
  let snapshotAvailable = true
  if (dataset) {
    try {
      data = { [dataset]: await readPublicDataset(dataset) }
    } catch (error) {
      snapshotAvailable = false
      console.error('Public search page snapshot unavailable:', error)
    }
  }

  const page = describePublicSearchPage(pathname, data)
  if (!page) {
    response.status(404).end('Public page not found')
    return
  }

  try {
    const html = renderPublicSearchHtml(await readTemplate(request), page)
    response.setHeader('content-type', 'text/html; charset=utf-8')
    response.setHeader('x-content-type-options', 'nosniff')
    response.setHeader('cache-control', snapshotAvailable
      ? 'public, s-maxage=300, stale-while-revalidate=3600'
      : 'no-store')
    response.status(200)
    if (request.method === 'HEAD') response.end()
    else response.send(html)
  } catch (error) {
    console.error('Public search page template unavailable:', error)
    response.status(503).end('The public page is temporarily unavailable.')
  }
}

export function renderPublicSearchHtml(template, page) {
  const titleTag = /<title>[^<]*<\/title>/i
  const descriptionTag = /<meta\s+name="description"\s+content="[^"]*"\s*\/>/i
  const rootTag = '<div id="root"></div>'
  if (!titleTag.test(template) || !descriptionTag.test(template) || !template.includes(rootTag) || !template.includes('</head>')) {
    throw new Error('Built portal HTML does not match the expected document structure')
  }

  const canonical = SITE_ORIGIN + page.canonicalPath
  const metadata = JSON.stringify({
    pathname: page.pathname,
    canonicalPath: page.canonicalPath,
    title: page.title,
    description: page.description,
  }).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026')
  const head = [
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    `<meta property="og:title" content="${escapeHtml(page.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(page.description)}" />`,
    `<script id="public-search-meta" type="application/json">${metadata}</script>`,
  ].join('\n    ')

  return template
    .replace(titleTag, `<title>${escapeHtml(page.title)}</title>`)
    .replace(descriptionTag, `<meta name="description" content="${escapeHtml(page.description)}" />`)
    .replace('</head>', `    ${head}\n  </head>`)
    .replace(rootTag, `<div id="root">${renderInitialContent(page)}</div>`)
}

function renderInitialContent(page) {
  const links = page.links.filter(link => link.href.startsWith('/')).map(link =>
    `<li style="margin:.65rem 0"><a style="color:#f2c35a" href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`,
  ).join('')
  return `<main style="box-sizing:border-box;max-width:72rem;margin:0 auto;padding:3rem 1.5rem;color:#f5f2ea;font-family:system-ui,sans-serif;line-height:1.5"><p style="color:#f2c35a;text-transform:uppercase;letter-spacing:.12em">Lobo Infinity Portal</p><h1 style="font-size:clamp(2rem,5vw,3.5rem);line-height:1.1">${escapeHtml(page.heading)}</h1><p>${escapeHtml(page.intro)}</p><nav aria-label="Explore this public page"><ul>${links}</ul></nav></main>`
}

async function readTemplate(request) {
  if (!templatePromise) {
    templatePromise = (async () => {
      for (const location of [
        join(process.cwd(), 'dist', 'app-shell.html'),
        new URL('../dist/app-shell.html', import.meta.url),
      ]) {
        try { return await readFile(location, 'utf8') } catch (error) {
          if (error?.code !== 'ENOENT') throw error
        }
      }

      // The built shell is also a static route. Some Vercel function bundles do
      // not mount build output next to their source even with includeFiles.
      const host = String(request.headers?.host || '').toLowerCase()
      const canonicalHost = new URL(SITE_ORIGIN).host
      const deploymentHost = String(process.env.VERCEL_URL || '').toLowerCase()
      const trustedHost = host === canonicalHost || (deploymentHost && host === deploymentHost) ? host : canonicalHost
      const response = await fetch(`https://${trustedHost}/app-shell.html`, {
        signal: AbortSignal.timeout(8_000),
        headers: host === trustedHost && request.headers?.cookie ? { cookie: request.headers.cookie } : {},
      })
      if (!response.ok) throw new Error(`Built portal shell returned HTTP ${response.status}`)
      return response.text()
    })().catch(error => { templatePromise = null; throw error })
  }
  return templatePromise
}

async function readPublicDataset(name, fetchObject = fetch) {
  if (!pointerCache || pointerCache.expires < Date.now()) {
    const pointer = await readJson(new URL('public-snapshots/current.json', snapshotOrigin), fetchObject)
    if (!/^\d{8}T\d{6}Z$/.test(pointer?.snapshotId)
      || pointer.basePath !== `public-snapshots/${pointer.snapshotId}/`) {
      throw new Error('Invalid public snapshot pointer')
    }
    pointerCache = { pointer, expires: Date.now() + 60_000 }
  }
  const { pointer } = pointerCache
  const envelope = await readJson(new URL(`${pointer.basePath}${name}.json`, snapshotOrigin), fetchObject)
  if (envelope.snapshotId !== pointer.snapshotId || !Array.isArray(envelope.data)) {
    throw new Error(`Invalid public ${name} snapshot`)
  }
  return envelope.data
}

async function readJson(url, fetchObject) {
  const result = await fetchObject(url, { signal: AbortSignal.timeout(7_000) })
  if (!result.ok) throw new Error(`Public snapshot returned HTTP ${result.status}`)
  return result.json()
}

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}
