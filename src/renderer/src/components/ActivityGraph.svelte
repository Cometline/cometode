<script lang="ts">
  import type { ActivityEntry } from '../../../preload/index.d'

  interface Props {
    data: ActivityEntry[]
  }

  let { data }: Props = $props()

  // Sized to fill the ~336px usable width of the 360px popup (13px per column: 10px cell + 3px gap)
  const WEEKS = 25

  function formatLocalDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  interface Day {
    date: string
    count: number
  }

  // Build a grid of WEEKS columns x 7 rows, ending on today, aligned so each
  // column starts on Sunday (like GitHub's contribution graph).
  const weeks = $derived.by<Day[][]>(() => {
    const countByDate = new Map(data.map((entry) => [entry.date, entry.count]))

    const today = new Date()
    const todayStr = formatLocalDate(today)

    // Find the Sunday that starts the current week
    const currentWeekStart = new Date(today)
    currentWeekStart.setDate(today.getDate() - today.getDay())

    // Go back (WEEKS - 1) more weeks to get the first column's Sunday
    const gridStart = new Date(currentWeekStart)
    gridStart.setDate(currentWeekStart.getDate() - (WEEKS - 1) * 7)

    const result: Day[][] = []
    for (let w = 0; w < WEEKS; w++) {
      const column: Day[] = []
      for (let d = 0; d < 7; d++) {
        const date = new Date(gridStart)
        date.setDate(gridStart.getDate() + w * 7 + d)
        const dateStr = formatLocalDate(date)
        if (dateStr > todayStr) {
          column.push({ date: dateStr, count: -1 })
        } else {
          column.push({ date: dateStr, count: countByDate.get(dateStr) ?? 0 })
        }
      }
      result.push(column)
    }
    return result
  })

  function levelClass(count: number): string {
    if (count < 0) return 'bg-transparent'
    if (count === 0) return 'bg-gray-100 dark:bg-gray-800'
    if (count === 1) return 'bg-emerald-200 dark:bg-emerald-900'
    if (count === 2) return 'bg-emerald-300 dark:bg-emerald-700'
    if (count <= 4) return 'bg-emerald-400 dark:bg-emerald-500'
    return 'bg-emerald-500 dark:bg-emerald-400'
  }

  function tooltip(day: Day): string {
    if (day.count < 0) return ''
    return `${day.date}: ${day.count} review${day.count === 1 ? '' : 's'}`
  }

  const MONTH_NAMES = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec'
  ]

  // Label a column with its month name only when that column is the first
  // column containing the 1st of a month (mirrors GitHub's month row).
  const monthLabels = $derived.by<(string | null)[]>(() => {
    return weeks.map((column) => {
      const firstOfMonthDay = column.find((day) => day.date.endsWith('-01'))
      if (!firstOfMonthDay) return null
      const month = Number(firstOfMonthDay.date.slice(5, 7)) - 1
      return MONTH_NAMES[month]
    })
  })
</script>

<div class="overflow-x-auto">
  <div class="w-fit">
    <div class="flex gap-[3px] mb-1">
      {#each monthLabels as label, i (i)}
        <div class="w-[10px] text-[9px] leading-none text-gray-400 dark:text-gray-500">
          {label ?? ''}
        </div>
      {/each}
    </div>
    <div class="flex gap-[3px]">
      {#each weeks as column, i (i)}
        <div class="flex flex-col gap-[3px]">
          {#each column as day (day.date)}
            <div
              class="w-[10px] h-[10px] rounded-xs {levelClass(day.count)}"
              title={tooltip(day)}
            ></div>
          {/each}
        </div>
      {/each}
    </div>
  </div>
</div>
