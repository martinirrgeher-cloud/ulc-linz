import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const migrationDirectory = path.resolve('supabase/migrations')
const filePattern = /^(\d{12})_[a-z0-9_]+\.sql$/

function fail(messages) {
  for (const message of messages) {
    console.error(`Migrationsprüfung: ${message}`)
  }
  process.exitCode = 1
}

async function main() {
  const entries = await readdir(migrationDirectory, { withFileTypes: true })
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort()

  const errors = []
  const timestamps = new Map()

  if (files.length === 0) {
    errors.push('Es wurden keine SQL-Migrationen gefunden.')
  }

  for (const file of files) {
    const match = file.match(filePattern)
    if (!match) {
      errors.push(`${file}: Dateiname muss dem vorhandenen Muster YYYYMMDDNNNN_beschreibung.sql entsprechen.`)
      continue
    }

    const timestamp = match[1]
    const duplicate = timestamps.get(timestamp)
    if (duplicate) {
      errors.push(`${file}: Zeitstempel ${timestamp} wird bereits von ${duplicate} verwendet.`)
    } else {
      timestamps.set(timestamp, file)
    }

    const content = await readFile(path.join(migrationDirectory, file), 'utf8')
    if (content.trim().length === 0) {
      errors.push(`${file}: Datei ist leer.`)
    }
    if (content.charCodeAt(0) === 0xfeff) {
      errors.push(`${file}: UTF-8-BOM entfernen.`)
    }
    if (/^(<{7}|={7}|>{7})/m.test(content)) {
      errors.push(`${file}: nicht aufgelöste Git-Konfliktmarkierung gefunden.`)
    }
  }

  if (errors.length > 0) {
    fail(errors)
    return
  }

  console.log(`Migrationsprüfung erfolgreich: ${files.length} Dateien geprüft.`)
}

main().catch((error) => {
  console.error('Migrationsprüfung konnte nicht ausgeführt werden.', error)
  process.exitCode = 1
})
