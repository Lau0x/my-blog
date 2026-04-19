<script setup lang="ts">
/**
 * 主题切换按钮：单图标 toggle
 *
 * 显示逻辑：
 * - 当前是暗色 → 显示「太阳」图标（提示：点我切到亮色）
 * - 当前是亮色 → 显示「月亮」图标（提示：点我切到暗色）
 *
 * auto 模式的保留：
 * - 初始访客 localStorage 无值 → useTheme 默认 'auto'，跟随系统
 * - 首次点击后切到明确的 light/dark，auto 状态退出
 * - UI 不给 auto 按钮——简化视觉，跟随系统作为"隐式默认"
 */
const { resolvedTheme, setPreference } = useTheme()

const isDark = computed(() => resolvedTheme.value === 'dark')

function toggle() {
  setPreference(isDark.value ? 'light' : 'dark')
}
</script>

<template>
  <button
    type="button"
    class="theme-toggle"
    :aria-label="isDark ? '切换到亮色模式' : '切换到暗色模式'"
    :title="isDark ? '切换到亮色模式' : '切换到暗色模式'"
    @click="toggle"
  >
    <!-- 暗色时显示太阳 -->
    <svg
      v-if="isDark"
      class="icon icon-sun"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>

    <!-- 亮色时显示月亮 -->
    <svg
      v-else
      class="icon icon-moon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  </button>
</template>

<style scoped>
.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 0;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  color: var(--fg-soft);
  transition: color 0.15s ease, background 0.15s ease, transform 0.3s ease;
}

.theme-toggle:hover {
  color: var(--accent);
  background: var(--accent-alpha-lo);
}

.theme-toggle:active {
  transform: scale(0.9);
}

.icon {
  display: block;
  /* 切换时图标小幅旋转动画 */
  animation: theme-icon-in 0.3s ease;
}

@keyframes theme-icon-in {
  from {
    opacity: 0;
    transform: rotate(-90deg) scale(0.6);
  }
  to {
    opacity: 1;
    transform: rotate(0) scale(1);
  }
}

/* 尊重"减少动效"偏好 */
@media (prefers-reduced-motion: reduce) {
  .icon { animation: none; }
  .theme-toggle { transition: none; }
}
</style>
