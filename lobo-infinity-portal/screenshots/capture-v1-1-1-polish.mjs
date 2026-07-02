import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { setTimeout as wait } from 'node:timers/promises'

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const debugPort = 9225
const root = 'C:\\Users\\19734\\Documents\\LoboInfinityLeague\\lobo-infinity-portal'
const userDataDir = `${root}\\screenshots\\edge-v1-1-1-polish-profile`
const baseUrl = 'http://127.0.0.1:4174'

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
  '--window-size=1440,1200',
  'about:blank',
])

try {
  const pageWsUrl = await getPageWebSocketUrl()
  const client = await createCdpClient(pageWsUrl)
  await client.send('Page.enable')
  await client.send('Runtime.enable')

  await capture(client, '/', 'defeated', 'v1-1-1-dashboard.png')
  await capture(client, '/players', '👑 Main Man (10)', 'v1-1-1-players.png')
  await capture(client, '/players/Lobo', 'Season Snapshot', 'v1-1-1-player-profile.png')
  await capture(client, '/standings', '👑 Main Man', 'v1-1-1-standings.png')

  await client.close()
} finally {
  browser.kill()
}

async function capture(client, path, text, fileName) {
  await client.send('Page.navigate', {
    url: `${baseUrl}${path}`,
  })
  await waitForText(client, text)
  await wait(700)
  await saveScreenshot(client, fileName)
}

async function saveScreenshot(client, fileName) {
  const screenshot = await client.send('Page.captureScreenshot', {
    captureBeyondViewport: true,
    format: 'png',
  })
  await writeFile(`${root}\\screenshots\\${fileName}`, Buffer.from(screenshot.data, 'base64'))
}

async function waitForText(client, text) {
  for (let attempt = 0; attempt < 120; attempt++) {
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
  for (let attempt = 0; attempt < 50; attempt++) {
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
