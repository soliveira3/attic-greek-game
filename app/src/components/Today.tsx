// Today's numbers, shown around the app: day streak, XP against the daily goal, reviews due.
import { useApp } from '../app/AppContext'
import { href } from '../app/router'
import { loadAttempts } from '../lib/attempts'
import { dailyXp, loadPath } from '../lib/path'
import { loadSrs } from '../lib/srs'
import { dueToday, streak } from '../lib/stats'
import { Icon } from './Icon'

export interface TodayStats {
  streak: number
  xp: number
  goal: number
  due: number
}

/** Recomputed whenever the store changes (AppState.version). */
export function useToday(): TodayStats {
  const { store, settings } = useApp()
  const now = new Date()
  const attempts = loadAttempts(store)
  return {
    streak: streak(attempts, now),
    xp: dailyXp(attempts, loadPath(store), now),
    goal: settings.dailyGoal,
    due: dueToday(loadSrs(store), now),
  }
}

export function StatChips({ stats }: { stats: TodayStats }) {
  return (
    <ul className="stat-chips" aria-label="Today">
      <li className={`chip-stat streak${stats.streak ? ' on' : ''}`} title="Day streak">
        <Icon name="flame" size={22} />
        <span>
          {stats.streak}
          <span className="sr-only"> day streak</span>
        </span>
      </li>
      <li className="chip-stat xp" title="XP today">
        <Icon name="bolt" size={22} />
        <span>
          {stats.xp}
          <span className="sr-only"> XP today</span>
        </span>
      </li>
      <li className="chip-stat due" title="Reviews due today">
        <a href={href('review')}>
          <Icon name="review" size={22} />
          <span>
            {stats.due}
            <span className="sr-only"> reviews due</span>
          </span>
        </a>
      </li>
    </ul>
  )
}

/** A ring that fills as the day's XP reaches the goal. */
export function GoalRing({ xp, goal, size = 64 }: { xp: number; goal: number; size?: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  const share = Math.min(1, goal ? xp / goal : 0)
  return (
    <svg className={`goal-ring${share >= 1 ? ' full' : ''}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r={r} className="ring-track" />
      <circle
        cx="32"
        cy="32"
        r={r}
        className="ring-fill"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - share)}
        transform="rotate(-90 32 32)"
      />
      <g transform="translate(20 20)">
        <path d="M13 2.5 5 13.5h6l-1 8 8-11h-6l1-8Z" className="ring-bolt" />
      </g>
    </svg>
  )
}

export function DailyGoal({ stats }: { stats: TodayStats }) {
  const reached = stats.xp >= stats.goal
  return (
    <section className="rail-card goal-card" aria-labelledby="goal-title">
      <GoalRing xp={stats.xp} goal={stats.goal} />
      <div>
        <h2 id="goal-title">Daily goal</h2>
        <p>{reached ? `Reached: ${stats.xp} XP today` : `${stats.xp} of ${stats.goal} XP today`}</p>
        <a className="small-link" href={href('settings')}>
          Change the goal
        </a>
      </div>
    </section>
  )
}
