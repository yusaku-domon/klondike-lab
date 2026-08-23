export const CURRENT_SCHEMA_VERSION = 1

type Migration = (data: Record<string, unknown>) => Record<string, unknown>

const migrations: Record<number, Migration> = {
  // schemaVersion 1 is both the initial and current version, so there is
  // nothing to migrate yet. Future schema changes add an entry here keyed
  // by the version being migrated FROM, e.g. `2: (v1) => ({ ...v1, ... })`.
}

export function migrateToCurrentSchema(data: unknown): Record<string, unknown> | null {
  if (typeof data !== 'object' || data === null) return null

  let current = data as Record<string, unknown>
  let version = current.schemaVersion

  while (typeof version === 'number' && version < CURRENT_SCHEMA_VERSION) {
    const migrate = migrations[version]
    if (!migrate) return null
    current = migrate(current)
    version = current.schemaVersion
  }

  return version === CURRENT_SCHEMA_VERSION ? current : null
}
