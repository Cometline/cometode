<script lang="ts">
  import { slide } from 'svelte/transition'
  import { problems, filters, todayReviews, loadProblems, loadTodayReviews, loadCategories, filterUIState, currentProblemSet, setProblemSet, initProblemSet } from '../stores/problems'
  import { stats, loadStats } from '../stores/stats'
  import type { Problem, ProblemSet } from '../../../preload/index.d'

  interface Props {
    onSelectProblem: (problem: Problem) => void
    onStartReview: () => void
  }

  let { onSelectProblem, onStartReview }: Props = $props()

  // Use store values for filter state persistence
  let searchText = $state($filterUIState.searchText)
  let selectedDifficulties = $state<string[]>([...$filterUIState.selectedDifficulties])
  let showDueOnly = $state($filterUIState.showDueOnly)
  let showFilterMenu = $state($filterUIState.showFilterMenu)

  // Sync local state back to store when changed
  $effect(() => {
    filterUIState.set({
      searchText,
      selectedDifficulties,
      showDueOnly,
      showFilterMenu
    })
  })

  // Load data on mount (only once, not reactive)
  $effect(() => {
    initProblemSet().then(() => {
      loadTodayReviews()
      loadStats()
      loadCategories()
    })
  })

  // Handle problem set change
  async function handleProblemSetChange(set: ProblemSet): Promise<void> {
    await setProblemSet(set)
    const newFilters: typeof $filters = {
      problemSet: set,
      difficulty: [...selectedDifficulties],
      searchText: searchText || undefined,
      dueOnly: showDueOnly || undefined
    }
    filters.set(newFilters)
    await Promise.all([
      loadProblems(newFilters),
      loadStats(set),
      loadTodayReviews()
    ])
  }

  // Apply filters when search/filter changes
  $effect(() => {
    // Spread to ensure Svelte tracks the array contents
    const difficulties = [...selectedDifficulties]
    const newFilters: typeof $filters = {
      problemSet: $currentProblemSet,
      difficulty: difficulties,
      searchText: searchText || undefined,
      dueOnly: showDueOnly || undefined
    }
    filters.set(newFilters)
    loadProblems(newFilters)
  })

  type ProblemStatus = 'new' | 'practiced' | 'due'

  function getProblemStatus(problem: Problem): ProblemStatus {
    if (problem.total_reviews === 0) return 'new'
    if (problem.next_review_date) {
      // Use local date (not UTC) to match backend's DATE('now', 'localtime')
      const today = new Date()
      const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      if (problem.next_review_date <= localToday) return 'due'
    }
    return 'practiced'
  }

  function getDifficultyColor(difficulty: string): string {
    switch (difficulty) {
      case 'Easy': return 'text-green-500'
      case 'Medium': return 'text-amber-500'
      case 'Hard': return 'text-red-500'
      default: return 'text-gray-500'
    }
  }

  function clearFilters(): void {
    searchText = ''
    selectedDifficulties = []
    showDueOnly = false
  }

  function selectRandomProblem(): void {
    if ($problems.length === 0) return
    const randomIndex = Math.floor(Math.random() * $problems.length)
    onSelectProblem($problems[randomIndex])
  }

  const hasActiveFilters = $derived(!!searchText || selectedDifficulties.length > 0 || showDueOnly)

  const progressPercentage = $derived(
    $stats ? Math.round(($stats.practiced / $stats.total) * 100) : 0
  )

  // Calculate tomorrow's review count from problems list
  const tomorrowReviewCount = $derived(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`

    return $problems.filter(p => p.next_review_date === tomorrowStr).length
  })
</script>

<div class="flex flex-col h-full">
  <!-- Problem Set Toggle -->
  <div class="mx-3 mt-3">
    <div class="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
      <button
        onclick={() => handleProblemSetChange('neetcode150')}
        class="flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer hover:scale-105 {$currentProblemSet === 'neetcode150' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}" 
      >
        NeetCode 150
      </button>
      <button
        onclick={() => handleProblemSetChange('google')}
        class="flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all  cursor-pointer hover:scale-105 {$currentProblemSet === 'google' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}"
      >
        Google
      </button>
    </div>
  </div>

  <!-- Review Status Card -->
  {#if $todayReviews.length > 0 || tomorrowReviewCount() > 0}
    <div class="mx-3 mt-3 p-3 bg-linear-to-r {$todayReviews.length > 0 ? 'from-orange-500 to-amber-500' : 'from-sky-500 to-blue-500'} rounded-lg text-white min-h-[100px]">
      {#if $todayReviews.length > 0}
        <div class="text-sm opacity-90">Due today</div>
        <div class="text-2xl font-bold">{$todayReviews.length} problem{$todayReviews.length > 1 ? 's' : ''}</div>
        <button
          onclick={onStartReview}
          class="mt-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-md text-sm font-medium transition-all hover:scale-105 cursor-pointer"
        >
          Start Review
        </button>
      {:else}
        <div class="flex flex-col justify-center h-full">
          <div class="text-sm opacity-90">Coming tomorrow</div>
          <div class="text-2xl font-bold">{tomorrowReviewCount()} problem{tomorrowReviewCount() > 1 ? 's' : ''}</div>
          <div class="mt-2 text-sm opacity-75">All caught up for today!</div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Progress Bar -->
  {#if $stats}
    <div class="mx-3 mt-3 mb-2">
      <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
        <span>{$stats.practiced}/{$stats.total} practiced</span>
        <span>{progressPercentage}%</span>
      </div>
      <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          class="h-full bg-emerald-400/90 transition-all duration-500"
          style="width: {progressPercentage}%"
        ></div>
      </div>
    </div>
  {/if}

  <!-- Search & Filter Bar -->
  <div class="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
    <div class="flex gap-2">
      <div class="flex-1 relative">
        <input
          type="text"
          placeholder="Search..."
          bind:value={searchText}
          class="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 rounded-md border-0 focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      <button
        onclick={selectRandomProblem}
        disabled={$problems.length === 0}
        title="Select a random problem"
        class="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer"
      >
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 512 512">
          <path d="M403.8 34.4c12-5 25.7-2.2 34.9 6.9l64 64c6 6 9.4 14.1 9.4 22.6s-3.4 16.6-9.4 22.6l-64 64c-9.2 9.2-22.9 11.9-34.9 6.9s-19.8-16.6-19.8-29.6l0-32-32 0c-10.1 0-19.6 4.7-25.6 12.8L284 229.3 244 176l31.2-41.6C293.3 110.2 321.8 96 352 96l32 0 0-32c0-12.9 7.8-24.6 19.8-29.6zM164 282.7L204 336l-31.2 41.6C154.7 401.8 126.2 416 96 416l-64 0c-17.7 0-32-14.3-32-32s14.3-32 32-32l64 0c10.1 0 19.6-4.7 25.6-12.8L164 282.7zm274.6 188c-9.2 9.2-22.9 11.9-34.9 6.9s-19.8-16.6-19.8-29.6l0-32-32 0c-30.2 0-58.7-14.2-76.8-38.4L121.6 172.8c-6-8.1-15.5-12.8-25.6-12.8l-64 0c-17.7 0-32-14.3-32-32s14.3-32 32-32l64 0c30.2 0 58.7 14.2 76.8 38.4L326.4 339.2c6 8.1 15.5 12.8 25.6 12.8l32 0 0-32c0-12.9 7.8-24.6 19.8-29.6s25.7-2.2 34.9 6.9l64 64c6 6 9.4 14.1 9.4 22.6s-3.4 16.6-9.4 22.6l-64 64z" />
        </svg>
      </button>

      <div class="relative">
        <button
          onclick={() => showFilterMenu = !showFilterMenu}
          class="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors {hasActiveFilters ? 'text-blue-500' : 'text-gray-500'} cursor-pointer"
          title="Filter problems"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        </button>

        <!-- Filter Dropdown -->
        {#if showFilterMenu}
          <div
            class="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10 cursor-pointer"
            role="menu"
            tabindex="-1"
            onclick={(e) => e.stopPropagation()}
            onkeydown={(e) => e.stopPropagation()}
          >
            <div class="p-2 border-b border-gray-200 dark:border-gray-700">
              <div class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Difficulty</div>
              <div class="flex gap-1">
                {#each ['Easy', 'Medium', 'Hard'] as diff}
                  <button
                    onclick={() => {
                      if (selectedDifficulties.includes(diff)) {
                        selectedDifficulties = selectedDifficulties.filter(d => d !== diff)
                      } else {
                        selectedDifficulties = [...selectedDifficulties, diff]
                      }
                    }}
                    class="flex-1 px-2 py-1 text-xs rounded transition-colors {selectedDifficulties.includes(diff) ? 'bg-indigo-400/90 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'} cursor-pointer"
                  >
                    {diff}
                  </button>
                {/each}
              </div>
            </div>
            <div class="p-2">
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  bind:checked={showDueOnly}
                  class="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                />
                <span class="text-sm">Due only</span>
              </label>
            </div>
            {#if hasActiveFilters}
              <div class="p-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  onclick={() => {
                    clearFilters()
                  }}
                  class="w-full text-xs text-red-500 hover:text-red-600"
                >
                  Clear filters
                </button>
              </div>
            {/if}
          </div>
          <!-- Overlay to close menu on outside click -->
          <div
            class="fixed inset-0 z-0"
            role="presentation"
            onclick={() => showFilterMenu = false}
            onkeydown={(e) => { if (e.key === 'Escape') showFilterMenu = false }}
          ></div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Problem List -->
  <div class="flex-1 overflow-y-auto">
    {#each $problems as problem, index (problem.id)}
      {@const status = getProblemStatus(problem)}
      <button
        transition:slide={{ duration: 300, delay: (index * 20) % 100 }}
        onclick={() => onSelectProblem(problem)}
        class="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 text-left transition-colors"
      >
        <!-- Status Icon -->
        <div class="w-5 shrink-0">
          {#if status === 'new'}
            <div class="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600"></div>
          {:else if status === 'due'}
            <svg class="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
          {:else}
            <svg class="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
          {/if}
        </div>

        <!-- Problem Info -->
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium truncate text-gray-900 dark:text-gray-100">
            {problem.neet_id}. {problem.title}
          </div>
        </div>

        <!-- Difficulty -->
        <div class="text-xs font-medium {getDifficultyColor(problem.difficulty)}">
          {problem.difficulty}
        </div>
      </button>
    {:else}
      <div class="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
        {hasActiveFilters ? 'No problems match your filters' : 'Loading...'}
      </div>
    {/each}
  </div>

  <!-- Footer -->
  <div class="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 text-center border-t border-gray-200 dark:border-gray-700">
    {$problems.length} problem{$problems.length !== 1 ? 's' : ''} ({$currentProblemSet === 'neetcode150' ? 'NeetCode 150' : 'Google'})
  </div>
</div>
