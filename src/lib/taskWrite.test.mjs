// Guards the bug this module exists to prevent: a task written to Firestore
// while the screens showing tasks keep their own stale copy, so saving appears
// to do nothing.
//
// Firestore is stubbed — what is under test is that every write reaches the
// shared store, and that a rejected write leaves the store as it was.
//
//   node --import ./src/lib/test-loader.mjs src/lib/taskWrite.test.mjs

import { useTaskStore } from '../store/taskStore.js'
import { addTask, patchTask, dropTask } from './taskWrite.js'

// The loader swaps lib/firebase/tasks for a stub that reads this global, so no
// test hook has to exist in the shipped code.
const __setFirestoreStub = (stub) => { globalThis.__firestoreStub = stub }

let failures = 0
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) failures++
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name +
    (ok ? '' : '\n        got ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)))
}

const reset = (tasks) => useTaskStore.setState({ tasks, initialized: true })
const titles = () => useTaskStore.getState().tasks.map((t) => t.title)
const byId = (id) => useTaskStore.getState().tasks.find((t) => t.id === id)

// ── The reported bug: create from the quick-action modal, see it on screen ────
reset([])
__setFirestoreStub({ create: async () => ({ id: 'new1' }) })
const created = await addTask({ title: 'Follow up with client', status: 'open' })
check('addTask returns the stored task', created, { id: 'new1', title: 'Follow up with client', status: 'open' })
check('addTask puts the task in the shared store', titles(), ['Follow up with client'])

// A failed create must not leave a phantom task behind.
reset([{ id: 'a', title: 'Existing', status: 'open' }])
__setFirestoreStub({ create: async () => { throw new Error('offline') } })
let threw = ''
try { await addTask({ title: 'Never saved', status: 'open' }) } catch (e) { threw = e.message }
check('a failed create rejects', threw, 'offline')
check('a failed create adds nothing', titles(), ['Existing'])

// ── Completing a task ────────────────────────────────────────────────────────
reset([{ id: 'a', title: 'Existing', status: 'open', priority: 'high' }])
__setFirestoreStub({ update: async () => ({ id: 'a' }) })
await patchTask('a', { status: 'completed' })
check('patchTask applies the change', byId('a').status, 'completed')

__setFirestoreStub({ update: async () => { throw new Error('denied') } })
threw = ''
try { await patchTask('a', { status: 'open' }) } catch (e) { threw = e.message }
check('a rejected update rethrows', threw, 'denied')
check('a rejected update rolls the status back', byId('a').status, 'completed')
check('a rejected update leaves untouched fields alone', byId('a').priority, 'high')

// ── Deleting a task ──────────────────────────────────────────────────────────
reset([{ id: 'a', title: 'One' }, { id: 'b', title: 'Two' }])
__setFirestoreStub({ delete: async () => ({}) })
await dropTask('a')
check('dropTask removes the task', titles(), ['Two'])

__setFirestoreStub({ delete: async () => { throw new Error('nope') } })
threw = ''
try { await dropTask('b') } catch (e) { threw = e.message }
check('a rejected delete rethrows', threw, 'nope')
check('a rejected delete puts the task back', titles(), ['Two'])

// ── The store guard: a failed refetch must not blank a populated list ────────
reset([{ id: 'a', title: 'One' }])
useTaskStore.getState().setTasks([])
check('setTasks([]) does not wipe a populated list', titles(), ['One'])
check('setTasks([]) still marks the store initialized', useTaskStore.getState().initialized, true)

useTaskStore.setState({ tasks: [], initialized: false })
useTaskStore.getState().setTasks([])
check('setTasks([]) on an empty store clears loading', useTaskStore.getState().initialized, true)

console.log(failures === 0 ? '\nAll passed.' : `\n${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
