<script lang="ts">
  import { onMount } from 'svelte'
  import HomeView from './components/HomeView.svelte'
  import ProblemView from './components/ProblemView.svelte'
  import ThemeToggle from './components/ThemeToggle.svelte'
  import { todayReviews, loadTodayReviews, loadProblems } from './stores/problems'
  import { loadStats } from './stores/stats'
  import { theme } from './stores/theme'
  import type { Problem } from '../../preload/index.d'

  type View = 'home' | 'problem'

  let currentView = $state<View>('home')
  let selectedProblem = $state<Problem | null>(null)
  let showResetConfirm = $state(false)
  let isResetting = $state(false)
  let showSettings = $state(false)
  let currentShortcut = $state('')
  let isRecordingShortcut = $state(false)
  let recordedKeys = $state<string[]>([])
  let updateReady = $state(false)
  let isCheckingUpdate = $state(false)
  let currentVersion = $state('')
  let updateInfo = $state<{ version: string; progress: number } | null>(null)
  let updateCheckInterval: ReturnType<typeof setInterval> | null = null

  onMount(async () => {
    await theme.init()
    await loadTodayReviews()
    // Load current shortcut
    currentShortcut = await window.api.getShortcut()
    // Check update status
    await refreshUpdateStatus()

    // Poll for update progress while downloading
    updateCheckInterval = setInterval(async () => {
      if (updateInfo && updateInfo.progress < 100) {
        await refreshUpdateStatus()
      }
    }, 1000)

    return () => {
      if (updateCheckInterval) clearInterval(updateCheckInterval)
    }
  })

  async function refreshUpdateStatus(): Promise<void> {
    const status = await window.api.getUpdateStatus()
    updateReady = status.updateReady
    currentVersion = status.currentVersion
    updateInfo = status.updateInfo
  }

  function selectProblem(problem: Problem): void {
    selectedProblem = problem
    currentView = 'problem'
  }

  function goHome(): void {
    selectedProblem = null
    currentView = 'home'
  }

  function startReview(): void {
    if ($todayReviews.length > 0) {
      selectProblem($todayReviews[0])
    }
  }

  function handleReset(): void {
    showResetConfirm = true
  }

  async function confirmReset(): Promise<void> {
    isResetting = true
    try {
      await window.api.resetAllProgress()
      await Promise.all([loadProblems(), loadTodayReviews(), loadStats()])
      showResetConfirm = false
      goHome()
    } finally {
      isResetting = false
    }
  }

  function cancelReset(): void {
    showResetConfirm = false
  }

  function openSettings(): void {
    showSettings = true
  }

  function closeSettings(): void {
    showSettings = false
    isRecordingShortcut = false
    recordedKeys = []
  }

  function startRecordingShortcut(): void {
    isRecordingShortcut = true
    recordedKeys = []
  }

  function handleShortcutKeyDown(e: KeyboardEvent): void {
    if (!isRecordingShortcut) return

    e.preventDefault()
    e.stopPropagation()

    const keys: string[] = []

    // Build modifier keys
    if (e.metaKey || e.ctrlKey) keys.push('CommandOrControl')
    if (e.altKey) keys.push('Alt')
    if (e.shiftKey) keys.push('Shift')

    // Add the main key (if not a modifier)
    const key = e.key.toUpperCase()
    if (!['META', 'CONTROL', 'ALT', 'SHIFT'].includes(key)) {
      keys.push(key)

      // We have a complete shortcut
      if (keys.length >= 2) {
        recordedKeys = keys
        saveShortcut(keys.join('+'))
      }
    }
  }

  async function saveShortcut(shortcut: string): Promise<void> {
    const result = await window.api.setShortcut(shortcut)
    if (result.success) {
      currentShortcut = result.shortcut
      isRecordingShortcut = false
      recordedKeys = []
    } else {
      // Failed to register - show error
      recordedKeys = []
    }
  }

  function formatShortcutDisplay(shortcut: string): string {
    return shortcut
      .replace('CommandOrControl', '⌘')
      .replace('Command', '⌘')
      .replace('Control', '⌃')
      .replace('Alt', '⌥')
      .replace('Shift', '⇧')
      .replace(/\+/g, ' ')
  }
</script>

<div class="h-screen flex flex-col bg-white dark:bg-gray-900 overflow-hidden">
  <!-- Header -->
  <header class="h-10 flex items-center justify-between px-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur flex-shrink-0">
    <div class="flex items-center gap-2">
      <span class="text-sm font-semibold text-gray-900 dark:text-gray-100">Cometode</span>
      {#if $todayReviews.length > 0 && currentView === 'home'}
        <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
      {/if}
    </div>

    <div class="flex items-center gap-1">
      <button
        onclick={openSettings}
        class="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        title="Settings"
      >
        <svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
      <ThemeToggle />
    </div>
  </header>

  <!-- Main Content -->
  <main class="flex-1 overflow-hidden">
    {#if currentView === 'home'}
      <HomeView
        onSelectProblem={selectProblem}
        onStartReview={startReview}
      />
    {:else if currentView === 'problem' && selectedProblem}
      <ProblemView
        problem={selectedProblem}
        onBack={goHome}
      />
    {/if}
  </main>
</div>

<!-- Settings Modal -->
{#if showSettings}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 mx-4 max-w-xs w-full">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">Settings</h3>
        <button
          onclick={closeSettings}
          class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Shortcut Setting -->
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Open Shortcut
        </label>
        <div class="flex gap-2">
          {#if isRecordingShortcut}
            <div class="flex-1 px-3 py-2 text-sm bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-400 rounded-md text-center text-indigo-700 dark:text-indigo-300 animate-pulse">
              {recordedKeys.length > 0 ? formatShortcutDisplay(recordedKeys.join('+')) : 'Press keys...'}
            </div>
          {:else}
            <div class="flex-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-md text-center font-mono text-gray-900 dark:text-gray-100">
              {formatShortcutDisplay(currentShortcut)}
            </div>
          {/if}
          <button
            onclick={startRecordingShortcut}
            class="px-3 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-md transition-colors"
          >
            {isRecordingShortcut ? 'Cancel' : 'Change'}
          </button>
        </div>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Press a key combination with Cmd/Ctrl
        </p>
      </div>

      <!-- Updates -->
      <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
        <div class="flex justify-between items-center mb-2">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Version</span>
          <span class="text-sm text-gray-500 dark:text-gray-400">v{currentVersion}</span>
        </div>

        {#if updateReady}
          <div class="mb-2 p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-md">
            <div class="text-sm text-emerald-700 dark:text-emerald-400">
              ✓ v{updateInfo?.version} ready to install
            </div>
          </div>
          <button
            onclick={async () => {
              await window.api.installUpdate()
            }}
            class="w-full px-3 py-2 text-sm font-medium text-white bg-emerald-500/90 hover:bg-emerald-600/95 rounded-md transition-colors shadow-sm"
          >
            🔄 Restart to Update
          </button>
        {:else if updateInfo && updateInfo.progress < 100}
          <div class="mb-2">
            <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Downloading v{updateInfo.version}</span>
              <span>{updateInfo.progress}%</span>
            </div>
            <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                class="h-full bg-indigo-400/90 transition-all duration-300"
                style="width: {updateInfo.progress}%"
              ></div>
            </div>
          </div>
        {:else}
          <button
            onclick={async () => {
              isCheckingUpdate = true
              await window.api.checkForUpdates()
              await refreshUpdateStatus()
              isCheckingUpdate = false
            }}
            disabled={isCheckingUpdate}
            class="w-full px-3 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-md transition-colors disabled:opacity-50"
          >
            {isCheckingUpdate ? 'Checking...' : 'Check for Updates'}
          </button>
        {/if}
      </div>

      <!-- Reset Progress -->
      <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onclick={() => { closeSettings(); handleReset(); }}
          class="w-full px-3 py-2 text-sm font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-md transition-colors"
        >
          Reset All Progress
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Reset Confirmation Modal -->
{#if showResetConfirm}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 mx-4 max-w-xs w-full">
      <div class="text-center">
        <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
          <svg class="w-6 h-6 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">Reset Progress?</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">This will delete all your review history and cannot be undone.</p>
        <div class="flex gap-2">
          <button
            onclick={cancelReset}
            disabled={isResetting}
            class="flex-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onclick={confirmReset}
            disabled={isResetting}
            class="flex-1 px-3 py-2 text-sm font-medium text-white bg-rose-500/90 hover:bg-rose-600/95 rounded-md transition-colors shadow-sm disabled:opacity-50"
          >
            {isResetting ? 'Resetting...' : 'Reset'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Capture keyboard events when recording shortcut -->
<svelte:window onkeydown={handleShortcutKeyDown} />
