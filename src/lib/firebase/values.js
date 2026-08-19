// Firestore REST value conversion, including the shapes the per-collection
// converters never handled.
//
// contacts.js, deals.js, properties.js and activities.js each carry their own
// copy of a toValue/fromValue pair, and every copy falls through to String(v)
// for anything that isn't a scalar. That turns ['a', 'b'] into "a,b" and
// { lat, lng } into "[object Object]" — silently, on write, with no error to
// notice. It has never mattered because those collections only store scalars.
//
// Memories store arrays (photos, linked contacts, tags) and a nested place
// object, so they need conversion that actually recurses. The older modules
// can adopt this the next time their converters cause trouble; this is written
// to be a drop-in for them.

export function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') {
    // Firestore distinguishes the two, and reading an integer back as a double
    // is how ids and counts pick up a stray ".0" downstream.
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  }
  if (typeof v === 'string') return { stringValue: v }
  if (v instanceof Date) return { timestampValue: v.toISOString() }
  if (Array.isArray(v)) {
    // Firestore rejects an empty `values` key, so an empty array is an
    // arrayValue with nothing in it.
    return { arrayValue: v.length ? { values: v.map(toValue) } : {} }
  }
  if (typeof v === 'object') return { mapValue: { fields: toFields(v) } }
  return { stringValue: String(v) }
}

export function fromValue(v) {
  if (!v) return null
  if ('nullValue' in v) return null
  if ('booleanValue' in v) return v.booleanValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('stringValue' in v) return v.stringValue
  if ('timestampValue' in v) return v.timestampValue
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue)
  if ('mapValue' in v) return fromFields(v.mapValue.fields || {})
  return null
}

/** Object → Firestore `fields`. Undefined values are dropped, not nulled. */
export function toFields(obj) {
  const fields = {}
  for (const [k, val] of Object.entries(obj)) {
    if (val !== undefined) fields[k] = toValue(val)
  }
  return fields
}

/** Firestore `fields` → plain object. */
export function fromFields(fields) {
  const obj = {}
  for (const [k, val] of Object.entries(fields)) obj[k] = fromValue(val)
  return obj
}
