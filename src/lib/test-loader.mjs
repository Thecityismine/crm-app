// Test-only module hooks. Two jobs:
//
//  1. Resolve the app's "@/..." alias, which vite provides in the browser build
//     and node knows nothing about (including vite's extensionless imports).
//  2. Stand a stub in for lib/firebase/tasks, so the test exercises the write
//     layer without a network or a Firebase project. The stub reads its
//     behaviour off a global the test sets per case.
import { registerHooks } from 'node:module'
import { pathToFileURL } from 'node:url'
import { resolve as resolvePath } from 'node:path'
import { existsSync } from 'node:fs'

const srcRoot = pathToFileURL(resolvePath(process.cwd(), 'src') + '/').href

const STUB = `
const pick = (name) => {
  const fn = (globalThis.__firestoreStub || {})[name]
  if (!fn) throw new Error('test called firebase/tasks.' + name + ' with no stub set')
  return fn
}
export const getTasks    = (...a) => pick('get')(...a)
export const createTask  = (...a) => pick('create')(...a)
export const updateTask  = (...a) => pick('update')(...a)
export const deleteTask  = (...a) => pick('delete')(...a)
`

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@/')) {
      let url = new URL(specifier.slice(2), srcRoot).href
      // vite lets imports omit .js; node does not.
      if (!/\.[a-z]+$/.test(url) && existsSync(new URL(url + '.js'))) url += '.js'
      return next(url, context)
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url.endsWith('/lib/firebase/tasks.js')) {
      return { format: 'module', shortCircuit: true, source: STUB }
    }
    return next(url, context)
  },
})
