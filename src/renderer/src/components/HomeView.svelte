<script lang="ts">
  import { problems, filters, todayReviews, loadProblems, loadTodayReviews, loadCategories, filterUIState } from '../stores/problems'
  import { stats, loadStats } from '../stores/stats'
  import type { Problem } from '../../../preload/index.d'

  interface Props {
    onSelectProblem: (problem: Problem) => void
    onStartReview: () => void
  }

  let { onSelectProblem, onStartReview }: Props = $props()

  // Use store values for filter state persistence
  let searchText = $state($filterUIState.searchText)
  let selectedDifficulty = $state<string | null>($filterUIState.selectedDifficulty)
  let showDueOnly = $state($filterUIState.showDueOnly)
  let showFilterMenu = $state($filterUIState.showFilterMenu)

  // Sync local state back to store when changed
  $effect(() => {
    filterUIState.set({
      searchText,
      selectedDifficulty,
      showDueOnly,
      showFilterMenu
    })
  })

  // Load data on mount (only once, not reactive)
  $effect(() => {
    loadTodayReviews()
    loadStats()
    loadCategories()
  })

  // Apply filters when search/filter changes
  $effect(() => {
    const newFilters: typeof $filters = {}
    if (searchText) newFilters.searchText = searchText
    if (selectedDifficulty) newFilters.difficulty = selectedDifficulty
    if (showDueOnly) newFilters.dueOnly = true
    filters.set(newFilters)
    loadProblems(newFilters)
  })

  type ProblemStatus = 'new' | 'practiced' | 'due'

  function getProblemStatus(problem: Problem): ProblemStatus {
    if (problem.total_reviews === 0) return 'new'
    if (problem.next_review_date) {
      const today = new Date().toISOString().split('T')[0]
      if (problem.next_review_date <= today) return 'due'
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
    selectedDifficulty = null
    showDueOnly = false
  }

  function selectRandomProblem(): void {
    if ($problems.length === 0) return
    const randomIndex = Math.floor(Math.random() * $problems.length)
    onSelectProblem($problems[randomIndex])
  }

  const hasActiveFilters = $derived(!!searchText || !!selectedDifficulty || showDueOnly)

  const progressPercentage = $derived(
    $stats ? Math.round(($stats.practiced / $stats.total) * 100) : 0
  )
</script>

<div class="flex flex-col h-full">
  <!-- Due Today Card -->
  {#if $todayReviews.length > 0}
    <div class="mx-3 mt-3 p-3 bg-gradient-to-r from-orange-500 to-amber-500 rounded-lg text-white">
      <div class="text-sm opacity-90">Due for review</div>
      <div class="text-2xl font-bold">{$todayReviews.length} problem{$todayReviews.length > 1 ? 's' : ''}</div>
      <button
        onclick={onStartReview}
        class="mt-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-md text-sm font-medium transition-colors"
      >
        Start Review
      </button>
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
        class="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
      >
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
        </svg>
      </button>
      <div class="relative">
        <button
          onclick={() => showFilterMenu = !showFilterMenu}
          class="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors {hasActiveFilters ? 'text-blue-500' : 'text-gray-500'}"
          title="Filter problems"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        </button>

        <!-- Filter Dropdown -->
        {#if showFilterMenu}
          <div
            class="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10"
            onclick={(e) => e.stopPropagation()}
          >
            <div class="p-2 border-b border-gray-200 dark:border-gray-700">
              <div class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Difficulty</div>
              <div class="flex gap-1">
                {#each ['Easy', 'Medium', 'Hard'] as diff}
                  <button
                    onclick={() => {
                      selectedDifficulty = selectedDifficulty === diff ? null : diff
                    }}
                    class="flex-1 px-2 py-1 text-xs rounded transition-colors {selectedDifficulty === diff ? 'bg-indigo-400/90 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'}"
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
            onclick={() => showFilterMenu = false}
          ></div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Problem List -->
  <div class="flex-1 overflow-y-auto">
    {#each $problems as problem (problem.id)}
      {@const status = getProblemStatus(problem)}
      <button
        onclick={() => onSelectProblem(problem)}
        class="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 text-left transition-colors"
      >
        <!-- Status Icon -->
        <div class="w-5 flex-shrink-0">
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
    {$problems.length} problem{$problems.length !== 1 ? 's' : ''}
  </div>
</div>
