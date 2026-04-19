<script setup lang="ts">
/**
 * 三段式主题切换器：☀️ 亮 / 🖥️ 跟随系统 / 🌙 暗
 * 放在 header 右侧搜索按钮旁
 *
 * 设计取舍：
 * - 三按钮一眼看全，无需点击循环
 * - auto 居中，符合"跟随系统=默认"的心智
 * - aria-pressed 标明当前选中，无障碍友好
 */
const { preference, setPreference } = useTheme()

const options = [
  { value: 'light' as const, label: '亮色', icon: '☀️' },
  { value: 'auto' as const, label: '跟随系统', icon: '🖥️' },
  { value: 'dark' as const, label: '暗色', icon: '🌙' },
]
</script>

<template>
  <div class="theme-switcher" role="radiogroup" aria-label="主题">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      role="radio"
      :aria-checked="preference === opt.value"
      :aria-label="opt.label"
      :title="opt.label"
      :class="['seg', { active: preference === opt.value }]"
      @click="setPreference(opt.value)"
    >
      <span class="icon">{{ opt.icon }}</span>
    </button>
  </div>
</template>

<style scoped>
.theme-switcher {
  display: inline-flex;
  align-items: center;
  padding: 3px;
  gap: 2px;
  background: var(--border-soft);
  border-radius: 999px;
  border: 1px solid var(--border-soft);
}

.seg {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  background: transparent;
  border-radius: 999px;
  cursor: pointer;
  font-size: 0.95rem;
  line-height: 1;
  color: var(--fg-soft);
  transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
}

.seg:hover {
  color: var(--fg);
}

.seg.active {
  background: var(--bg-card);
  color: var(--fg);
  box-shadow: var(--shadow-sm);
}

.seg .icon {
  display: block;
  /* emoji 在 Mac/Win 渲染尺寸有差 —— 视觉对齐 */
  filter: grayscale(0);
  font-size: 0.88rem;
}

/* 窄屏只保留当前选中的 seg，其它 tap 切换 */
@media (max-width: 480px) {
  .theme-switcher {
    padding: 2px;
  }
  .seg {
    width: 26px;
    height: 26px;
  }
}
</style>
