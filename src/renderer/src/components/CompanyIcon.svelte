<script lang="ts">
  import type { ProblemSet } from '../../../preload/index.d'

  interface Props {
    set: ProblemSet
    class?: string
  }

  let { set, class: className = 'w-4 h-4' }: Props = $props()
</script>

{#if set === 'all'}
  <svg viewBox="0 0 24 24" fill="none" class={className} aria-hidden="true">
    <line x1="8" y1="6" x2="21" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    <line x1="8" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    <line x1="8" y1="18" x2="21" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    <circle cx="4" cy="6" r="1.3" fill="currentColor" />
    <circle cx="4" cy="12" r="1.3" fill="currentColor" />
    <circle cx="4" cy="18" r="1.3" fill="currentColor" />
  </svg>
{:else if set === 'neetcode150'}
  <span class="text-[10px] font-bold leading-none tracking-tight" style="color: #10B981">150</span>
{:else if set === 'google'}
  <svg viewBox="0 0 24 24" class={className} aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.69-2.26 1.1-3.71 1.1-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.14c-.22-.69-.35-1.42-.35-2.14s.13-1.45.35-2.14V7.02H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.98l3.66-2.84z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.02l3.66 2.84c.87-2.6 3.3-4.48 6.16-4.48z"
    />
  </svg>
{:else if set === 'amazon'}
  <svg viewBox="0 0 24 24" fill="none" class={className} aria-hidden="true">
    <path
      d="M4 14.2c4.1 3.4 12 3.4 16 0"
      stroke="#FF9900"
      stroke-width="2"
      stroke-linecap="round"
    />
    <path
      d="M17.3 12.6l3 1.3-1.1 3.1"
      stroke="#FF9900"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
{:else if set === 'meta'}
  <svg viewBox="0 0 24 24" class={className} aria-hidden="true">
    <path
      fill="#0081FB"
      d="M6.5 8c-2.2 0-3.9 2-3.9 4.5S4.3 17 6.5 17c1.5 0 2.6-.9 3.8-2.7.4-.6.8-1.3 1.2-2 .4.7.8 1.4 1.2 2C13.9 16.1 15 17 16.5 17c2.2 0 3.9-2 3.9-4.5S18.7 8 16.5 8c-1.5 0-2.7.9-3.9 2.7-.3.5-.7 1.1-1.1 1.8-.4-.7-.8-1.3-1.1-1.8C9.2 8.9 8 8 6.5 8z"
    />
  </svg>
{:else if set === 'microsoft'}
  <svg viewBox="0 0 24 24" class={className} aria-hidden="true">
    <rect x="2" y="2" width="9.2" height="9.2" fill="#F25022" />
    <rect x="12.8" y="2" width="9.2" height="9.2" fill="#7FBA00" />
    <rect x="2" y="12.8" width="9.2" height="9.2" fill="#00A4EF" />
    <rect x="12.8" y="12.8" width="9.2" height="9.2" fill="#FFB900" />
  </svg>
{/if}
