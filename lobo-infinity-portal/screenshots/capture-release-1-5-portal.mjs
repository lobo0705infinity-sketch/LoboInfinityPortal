import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { setTimeout as wait } from 'node:timers/promises'

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const debugPort = 9231
const root = 'C:\\Users\\19734\\Documents\\LoboInfinityLeague\\lobo-infinity-portal'
const userDataDir = `${root}\\screenshots\\edge-release-1-5-profile`
const baseUrl = 'http://127.0.0.1:4175'

await rm(userDataDir, {
  force: true,
  recursive: true,
})
await mkdir(userDataDir, {
  recursive: true,
})

const browser = spawn(edgePath, [
  '--headless=new',
  '--disable-gpu',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${userDataDir}`,
  '--window-size=1440,1100',
  'about:blank',
])

try {
  const pageWsUrl = await getPageWebSocketUrl()
  const client = await createCdpClient(pageWsUrl)
  await client.send('Page.enable')
  await client.send('Runtime.enable')

  await setViewport(client, 1440, 1100)
  await capture(client, '/', 'Featured Match', 'release-1-5-dashboard-desktop.png')

  await setViewport(client, 900, 1100)
  await capture(client, '/', 'Featured Match', 'release-1-5-dashboard-tablet.png')

  await setViewport(client, 390, 900)
  await capture(client, '/', 'Featured Match', 'release-1-5-dashboard-mobile.png')

  await setViewport(client, 1440, 1000)
  await navigate(client, '/', 'Featured Match')
  await typeSearch(client, 'Lobo')
  await waitForText(client, 'Player')
  await saveScreenshot(client, 'release-1-5-search.png')

  await capture(client, '/players/Lobo', 'Season Snapshot', 'release-1-5-player.png')
  await capture(
    client,
    '/factions/Tartary%20Army%20Corps',
    'Faction Profile',
    'release-1-5-faction.png',
  )
  await capture(
    client,
    '/missions/Corporate%20Appropriation',
    'Mission Profile',
    'release-1-5-mission.png',
  )
  await capture(client, '/games/1', 'Match Result', 'release-1-5-match.png')
  await capture(client, '/analytics', 'League Intelligence', 'release-1-5-analytics.png')

  await client.close()
} finally {
  browser.kill()
}

async function capture(client, path, text, fileName) {
  await navigate(client, path, text)
  await saveScreenshot(client, fileName)
}

async function navigate(client, path, text) {
  await client.send('Page.navigate', {
    url: `${baseUrl}${path}`,
  })
  await waitForText(client, text)
  await wait(900)
}

async function typeSearch(client, query) {
  await client.send('Runtime.evaluate', {
    expression: `
      (() => {
        const input = document.querySelector('#global-search');
        input.focus();
        input.value = ${JSON.stringify(query)};
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `,
    returnByValue: true,
  })
  await wait(900)
}

async function setViewport(client, width, height) {
  await client.send('Emulation.setDeviceMetricsOverride', {
    deviceScaleFactor: 1,
    height,
    mobile: width < 700,
    width,
  })
}

async function saveScreenshot(client, fileName) {
  const screenshot = await client.send('Page.captureScreenshot', {
    captureBeyondViewport: true,
    format: 'png',
  })
  await writeFile(
    `${root}\\screenshots\\${fileName}`,
    Buffer.from(screenshot.data, 'base64'),
  )
}

async function waitForText(client, text) {
  for (let attempt = 0; attempt < 160; attempt++) {
    const result = await client.send('Runtime.evaluate', {
      expression: `document.body.innerText.includes(${JSON.stringify(text)})`,
      returnByValue: true,
    })

    if (result.result.value === true) {
      return
    }

    await wait(250)
  }

  throw new Error(`Timed out waiting for text: ${text}`)
}

async function getPageWebSocketUrl() {
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`)
      const targets = await response.json()
      const page = targets.find((target) => target.type === 'page')

      if (page?.webSocketDebuggerUrl) {
        return page.webSocketDebuggerUrl
      }
    } catch {
      await wait(100)
    }

    await wait(100)
  }

  throw new Error('Could not connect to browser debugging target.')
}

async function createCdpClient(url) {
  const socket = new WebSocket(url)
  let nextId = 1
  const pending = new Map()

  socket.addEventListener('message', (message) => {
    const payload = JSON.parse(message.data)

    if (!payload.id) {
      return
    }

    const request = pending.get(payload.id)
    pending.delete(payload.id)

    if (payload.error) {
      request.reject(new Error(payload.error.message))
      return
    }

    request.resolve(payload.result)
  })

  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, {
      once: true,
    })
    socket.addEventListener('error', reject, {
      once: true,
    })
  })

  return {
    close() {
      socket.close()
    },
    send(method, params = {}) {
      const id = nextId
      nextId += 1

      socket.send(
        JSON.stringify({
          id,
          method,
          params,
        }),
      )

      return new Promise((resolve, reject) => {
        pending.set(id, {
          reject,
          resolve,
        })
      })
    },
  }
}
