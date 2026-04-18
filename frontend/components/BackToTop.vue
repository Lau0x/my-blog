<script setup lang="ts">
const visible = ref(false)

function onScroll() {
  visible.value = window.scrollY > 300
}

function toTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <Transition name="fade">
    <button
      v-show="visible"
      type="button"
      class="back-to-top"
      aria-label="返回顶部"
      @click="toTop"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>
  </Transition>
</template>

<style scoped>
.back-to-top {
  position: fixed;
  right: 1.5rem;
  bottom: 1.5rem;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border, #e0e0e0);
  color: var(--fg-soft, #555);
  box-shadow: var(--shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 100;
  transition: transform 0.15s ease, color 0.15s ease, background 0.15s ease;
}
.back-to-top:hover {
  color: var(--accent, #3b6cb5);
  transform: translateY(-2px);
  background: var(--bg, #fff);
}
.back-to-top:active {
  transform: translateY(0);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (max-width: 640px) {
  .back-to-top {
    right: 1rem;
    bottom: 1rem;
    width: 36px;
    height: 36px;
  }
}
</style>
