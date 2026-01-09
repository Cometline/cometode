<script lang="ts">
  import { problems, filters, todayReviews, loadProblems, loadTodayReviews, loadCategories } from '../stores/problems'
  import { stats, loadStats } from '../stores/stats'
  import type { Problem } from '../../../preload/index.d'

  interface Props {
    onSelectProblem: (problem: Problem) => void
    onStartReview: () => void
  }

  let { onSelectProblem, onStartReview }: Props = $props()

  let searchText = $state('')
  let selectedDifficulty = $state<string | null>(null)
  let showDueOnly = $state(false)
  let showFilterMenu = $state(false)

  // Load data on mount
  $effect(() => {
    loadProblems()
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
          class="h-full bg-green-500 transition-all duration-500"
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
      <div class="relative">
        <button
          onclick={() => showFilterMenu = !showFilterMenu}
          class="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors {hasActiveFilters ? 'text-blue-500' : 'text-gray-500'}"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        </button>

        <!-- Filter Dropdown -->
        {#if showFilterMenu}
          <div class="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
            <div class="p-2 border-b border-gray-200 dark:border-gray-700">
              <div class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Difficulty</div>
              <div class="flex gap-1">
                {#each ['Easy', 'Medium', 'Hard'] as diff}
                  <button
                    onclick={() => selectedDifficulty = selectedDifficulty === diff ? null : diff}
                    class="flex-1 px-2 py-1 text-xs rounded transition-colors {selectedDifficulty === diff ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'}"
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
                  onclick={clearFilters}
                  class="w-full text-xs text-red-500 hover:text-red-600"
                >
                  Clear filters
                </button>
              </div>
            {/if}
          </div>
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
