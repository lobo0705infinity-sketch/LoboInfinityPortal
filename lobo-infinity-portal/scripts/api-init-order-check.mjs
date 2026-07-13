import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const backendDir = fileURLToPath(new URL('../backend/', import.meta.url))
const identifiers = ['auth', 'params']
const failures = []

for (const file of readdirSync(backendDir)) {
  if (!file.endsWith('.gs')) continue

  const path = join(backendDir, file)
  const source = readFileSync(path, 'utf8')
  const lines = source.split(/\r?\n/)

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^\s*function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*\{/)
    if (!match) continue

    const [, name, rawParams] = match
    const args = rawParams
      .split(',')
      .map((arg) => arg.trim())
      .filter(Boolean)

    if (!args.includes('e')) continue

    const body = collectFunctionBody(lines, index)
    const initialized = new Set(args)
    const pendingLine = new Map()

    body.forEach((line, offset) => {
      const lineNumber = index + offset + 1
      const callbackParams = line.match(/\bfunction\s*\(([^)]*)\)/)
      const declaration = line.match(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\b/)

      if (callbackParams) {
        callbackParams[1]
          .split(',')
          .map((arg) => arg.trim())
          .filter(Boolean)
          .forEach((arg) => initialized.add(arg))
      }

      identifiers.forEach((identifier) => {
        if (initialized.has(identifier)) return
        if (pendingLine.has(identifier)) return
        if (usesIdentifier(line, identifier, declaration?.[1])) {
          pendingLine.set(identifier, lineNumber)
        }
      })

      if (declaration) {
        initialized.add(declaration[1])
      }
    })

    pendingLine.forEach((lineNumber, identifier) => {
      failures.push(`${file}:${lineNumber} ${name}() references ${identifier} before declaration`)
    })
  }
}

if (failures.length > 0) {
  console.error('API initialization order check failed:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('API initialization order check passed.')

function collectFunctionBody(lines, startIndex) {
  const body = []
  let depth = 0
  let started = false

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index]
    body.push(line)

    for (const char of stripLineComment(line)) {
      if (char === '{') {
        depth += 1
        started = true
      } else if (char === '}') {
        depth -= 1
      }
    }

    if (started && depth === 0) break
  }

  return body
}

function usesIdentifier(line, identifier, declarationName) {
  if (declarationName === identifier) {
    const afterEquals = line.split('=').slice(1).join('=')
    return new RegExp(`\\b${identifier}\\b`).test(stripStrings(stripLineComment(afterEquals)))
  }

  return new RegExp(`\\b${identifier}\\b`).test(stripStrings(stripLineComment(line)))
}

function stripLineComment(line) {
  const index = line.indexOf('//')
  return index === -1 ? line : line.slice(0, index)
}

function stripStrings(line) {
  return line
    .replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, "''")
    .replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, '""')
    .replace(/`[^`\\]*(?:\\.[^`\\]*)*`/g, '``')
}
