import { describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION, migrateToCurrentSchema } from './migrations'

describe('migrateToCurrentSchema', () => {
  it('passes through data that is already at the current schema version', () => {
    const data = { schemaVersion: CURRENT_SCHEMA_VERSION, foo: 'bar' }
    expect(migrateToCurrentSchema(data)).toEqual(data)
  })

  it('rejects non-object input', () => {
    expect(migrateToCurrentSchema(null)).toBeNull()
    expect(migrateToCurrentSchema('nope')).toBeNull()
    expect(migrateToCurrentSchema(42)).toBeNull()
  })

  it('rejects data with a missing or non-numeric schemaVersion', () => {
    expect(migrateToCurrentSchema({})).toBeNull()
    expect(migrateToCurrentSchema({ schemaVersion: '1' })).toBeNull()
  })

  it('rejects an older schemaVersion with no registered migration', () => {
    expect(migrateToCurrentSchema({ schemaVersion: 0 })).toBeNull()
  })

  it('rejects a schemaVersion newer than the current one', () => {
    expect(migrateToCurrentSchema({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toBeNull()
  })
})
