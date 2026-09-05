// Guards the bug this module exists to prevent: a task written to Firestore
// while the screens showing tasks keep their own stale copy, so saving appears
// to do nothing.
//
// Firestore is stubbed — what is under test is that every write reaches the
// shared store, and that a rejected write leaves the store as it was.
//
//   node --import ./src/lib/test-loader.mjs src/lib/taskWrite.test.mjs

import { useTaskStore } from '../store/taskStore.js'
import { addTask, patchTask, dropTask, completeTask } from './taskWrite.js'

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

// ── Completing a repeating task opens the next one ───────────────────────────
// The finished instance stays put — the Done tab is a record of what got done,
// not one row being recycled — and exactly one replacement appears.
reset([{ id: 'a', title: 'Monthly statement', status: 'open', priority: 'high',
         dueDate: '2020-01-15', recurrence: 'monthly', contactName: 'Dana Reyes' }])
__setFirestoreStub({ update: async () => ({}), create: async () => ({ id: 'b' }) })
await completeTask(useTaskStore.getState().tasks[0])
const opened = useTaskStore.getState().tasks.find((t) => t.id === 'b')
check('the finished instance stays completed', byId('a').status, 'completed')
check('a replacement is opened',                opened?.status, 'open')
check('it carries the task forward',            opened?.title, 'Monthly statement')
check('and its details with it',                opened?.contactName, 'Dana Reyes')
check('and keeps repeating',                    opened?.recurrence, 'monthly')
check('the new due date is not the old one',    opened?.dueDate !== '2020-01-15', true)
check('exactly one replacement',                useTaskStore.getState().tasks.length, 2)

// A one-off task must not spawn anything.
reset([{ id: 'a', title: 'Call back', status: 'open', dueDate: '2026-03-01' }])
__setFirestoreStub({ update: async () => ({}) })
check('completing a one-off returns nothing', await completeTask(byId('a')), null)
check('and adds no second task',              titles(), ['Call back'])

// Re-opening is a plain status change. If it spawned too, ticking a box twice
// would leave a stray copy behind every time.
reset([{ id: 'a', title: 'Weekly walk-through', status: 'completed', recurrence: 'weekly', dueDate: '2026-03-01' }])
__setFirestoreStub({ update: async () => ({}) })
await patchTask('a', { status: 'open' })
check('re-opening spawns nothing', titles(), ['Weekly walk-through'])

// A rejected completion must not open the next one either.
reset([{ id: 'a', title: 'Monthly statement', status: 'open', recurrence: 'monthly', dueDate: '2026-03-01' }])
__setFirestoreStub({ update: async () => { throw new Error('denied') } })
threw = ''
try { await completeTask(byId('a')) } catch (e) { threw = e.message }
check('a rejected completion rethrows',      threw, 'denied')
check('and leaves the task open',            byId('a').status, 'open')
check('and opens no next occurrence',        titles(), ['Monthly statement'])

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
