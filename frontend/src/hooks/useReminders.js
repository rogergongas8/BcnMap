const STORAGE_KEY      = 'bcn:reminders'
const REMIND_BEFORE_MS = 30 * 60 * 1000  // 30 min before event
const MORNING_HOUR     = 9               // for all-day events: remind at 09:00 on event day

// Extract first HH:MM from a timetable string like "20:00-22:00" or "De 10:00 a 14:00"
function parseFirstTime(timetable) {
  if (!timetable) return null
  const m = timetable.match(/\b(\d{1,2}):(\d{2})\b/)
  return m ? `${String(m[1]).padStart(2, '0')}:${m[2]}` : null
}

function getEventTime(event) {
  return event.time ?? parseFirstTime(event.timetable) ?? null
}

function reminderKey(event) {
  return `${event.title}|${event.start ?? ''}`
}

function buildReminderDate(event) {
  const date = event.start
  if (!date) return null
  const time = getEventTime(event)
  if (time) {
    // Remind 30 min before start
    const [h, m] = time.split(':').map(Number)
    const dt = new Date(`${date}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`)
    return new Date(dt.getTime() - REMIND_BEFORE_MS)
  }
  // All-day event: remind at 09:00 on the event day
  return new Date(`${date}T${String(MORNING_HOUR).padStart(2,'0')}:00:00`)
}

function loadAll() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}

function saveAll(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

async function requestPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

// ── Public API ───────────────────────────────────────────────────────────────

export function hasReminder(event) {
  return loadAll().some(r => r.key === reminderKey(event))
}

export async function addReminder(event) {
  const key      = reminderKey(event)
  const fireAt   = buildReminderDate(event)
  if (!fireAt) return 'no_date'

  const list = loadAll()
  if (list.find(r => r.key === key)) return 'exists'

  const granted = await requestPermission()
  if (!granted) return 'denied'

  list.push({
    key,
    title:  event.title,
    place:  event.place ?? null,
    date:   event.start ?? null,
    time:   getEventTime(event),
    fireAt: fireAt.toISOString(),
    lat:    event.lat ?? null,
    lng:    event.lng ?? null,
  })
  saveAll(list)
  return 'added'
}

export function removeReminder(event) {
  const key = reminderKey(event)
  saveAll(loadAll().filter(r => r.key !== key))
}

// Called on app mount and every minute — fires due notifications
export function checkAndFireReminders() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const now    = Date.now()
  const list   = loadAll()
  const stale  = []

  list.forEach(r => {
    const fire = new Date(r.fireAt).getTime()
    // Fire if we're within the window: [fireAt - 2min, fireAt + 5min]
    if (now >= fire - 2 * 60_000 && now <= fire + 5 * 60_000) {
      const minsToEvent = r.time
        ? Math.round((new Date(`${r.date}T${r.time}:00`) - now) / 60_000)
        : null
      const body = [
        minsToEvent != null && minsToEvent > 0 ? `Comença en ${minsToEvent} min` : 'Comença aviat',
        r.place,
      ].filter(Boolean).join(' · ')

      new Notification(r.title, {
        body,
        icon:    '/icons/icon-192.png',
        tag:     r.key,
        silent:  false,
      })
    }
    // Remove reminders from the past (>2h ago)
    if (now > fire + 2 * 60 * 60_000) stale.push(r.key)
  })

  if (stale.length) saveAll(list.filter(r => !stale.includes(r.key)))
}
