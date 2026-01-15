<script lang="ts">
  import type { Problem } from '../../../preload/index.d'
  import { submitReview, loadProblems, loadTodayReviews } from '../stores/problems'
  import { loadStats } from '../stores/stats'

  interface Props {
    problem: Problem
    onBack: () => void
  }

  let { problem, onBack }: Props = $props()

  let isSubmitting = $state(false)
  let showSuccess = $state(false)
  let successInfo = $state<{ nextDate: string; interval: number } | null>(null)

  const categories = $derived(JSON.parse(problem.categories || '[]') as string[])

  const isDue = $derived(() => {
    if (!problem.next_review_date) return false
    const today = new Date().toISOString().split('T')[0]
    return problem.next_review_date <= today
  })

  async function handleReview(quality: number): Promise<void> {
    if (isSubmitting) return
    isSubmitting = true

    try {
      const result = await submitReview(problem.id, quality)
      if (result.success) {
        successInfo = {
          nextDate: result.nextReviewDate,
          interval: result.newInterval
        }
        showSuccess = true

        // Reload data
        await Promise.all([loadProblems(), loadTodayReviews(), loadStats()])

        // Auto-close after delay
        setTimeout(() => {
          onBack()
        }, 1500)
      }
    } finally {
      isSubmitting = false
    }
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return 'Not scheduled'
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const qualityOptions = [
    { value: 0, label: '1', description: 'Again', color: 'bg-rose-400/90 hover:bg-rose-500/95 shadow-sm shadow-rose-200 dark:shadow-rose-900/30' },
    { value: 1, label: '2', description: 'Hard', color: 'bg-amber-400/90 hover:bg-amber-500/95 shadow-sm shadow-amber-200 dark:shadow-amber-900/30' },
    { value: 2, label: '3', description: 'Good', color: 'bg-teal-400/90 hover:bg-teal-500/95 shadow-sm shadow-teal-200 dark:shadow-teal-900/30' },
    { value: 3, label: '4', description: 'Easy', color: 'bg-emerald-400/90 hover:bg-emerald-500/95 shadow-sm shadow-emerald-200 dark:shadow-emerald-900/30' }
  ]
</script>

<div class="flex flex-col h-full">
  <!-- Header -->
  <div class="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
    <button
      onclick={onBack}
      class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      aria-label="Go back"
    >
      <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
    </button>
    <div class="flex-1 font-medium text-sm truncate text-gray-900 dark:text-gray-100">
      {problem.neet_id}. {problem.title}
    </div>
  </div>

  <!-- Content -->
  <div class="flex-1 overflow-y-auto p-3">
    {#if showSuccess}
      <!-- Success State -->
      <div class="flex flex-col items-center justify-center h-full text-center">
        <div class="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
          <svg class="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">Review Saved!</div>
        {#if successInfo}
          <div class="text-sm text-gray-500 dark:text-gray-400">
            Next review in {successInfo.interval} day{successInfo.interval !== 1 ? 's' : ''}
          </div>
          <div class="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {formatDate(successInfo.nextDate)}
          </div>
        {/if}
      </div>
    {:else}
      <!-- Problem Info -->
      <div class="space-y-3">
        <!-- Difficulty & Category -->
        <div class="flex flex-wrap gap-2">
          <span class="px-2 py-0.5 rounded text-xs font-medium {
            problem.difficulty === 'Easy' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
            problem.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
            'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
          }">
            {problem.difficulty}
          </span>
          {#each categories as category}
            <span class="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {category}
            </span>
          {/each}
        </div>

        <!-- External Link -->
        <a
          href={problem.neetcode_url}
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center justify-center gap-1.5 px-3 py-2 bg-orange-400/90 hover:bg-orange-500/95 text-white rounded-md text-sm font-medium transition-colors shadow-sm"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
            <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
          </svg>
          Open in NeetCode
        </a>

        <!-- Progress Info -->
        {#if problem.total_reviews > 0}
          <div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
            <div class="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div class="text-gray-500 dark:text-gray-400 text-xs">Reviews</div>
                <div class="font-medium text-gray-900 dark:text-gray-100">{problem.total_reviews}</div>
              </div>
              <div>
                <div class="text-gray-500 dark:text-gray-400 text-xs">Interval</div>
                <div class="font-medium text-gray-900 dark:text-gray-100">{problem.interval} days</div>
              </div>
              <div>
                <div class="text-gray-500 dark:text-gray-400 text-xs">Ease</div>
                <div class="font-medium text-gray-900 dark:text-gray-100">{problem.ease_factor.toFixed(2)}</div>
              </div>
              <div>
                <div class="text-gray-500 dark:text-gray-400 text-xs">Next Review</div>
                <div class="font-medium text-gray-900 dark:text-gray-100 {isDue ? 'text-amber-500' : ''}">
                  {formatDate(problem.next_review_date)}
                </div>
              </div>
            </div>
          </div>
        {/if}

        <!-- Rating Section -->
        <div class="pt-2">
          <div class="text-center mb-3">
            <div class="text-sm font-medium text-gray-700 dark:text-gray-300">
              Rate your recall
            </div>
          </div>
          <div class="grid grid-cols-4 gap-2">
            {#each qualityOptions as option}
              <button
                onclick={() => handleReview(option.value)}
                disabled={isSubmitting}
                class="py-2 {option.color} text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 border-gray-300" 
              >
                <div>{option.label}</div>
                <div class="text-xs opacity-75">{option.description}</div>
              </button>
            {/each}
          </div>
          <div class="text-center mt-2 text-xs text-gray-500 dark:text-gray-400">
            Press 1-4 to quick rate
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<svelte:window
  onkeydown={(e) => {
    if (showSuccess || isSubmitting) return
    const key = parseInt(e.key)
    if (key >= 1 && key <= 4) {
      handleReview(key - 1)
    }
  }}
/>
