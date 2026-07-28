import { ref } from 'vue'

export function persistedSize(key: string, fallback: number) {
  const saved = Number(localStorage.getItem(`api-studio:size:${key}`) || localStorage.getItem(`apiforge:size:${key}`))
  const value = ref(Number.isFinite(saved) && saved > 0 ? saved : fallback)
  const set = (next: number) => { value.value = Math.round(next); localStorage.setItem(`api-studio:size:${key}`, String(value.value)) }
  return { size: value, set }
}

export function beginResize(event: PointerEvent, axis: 'x' | 'y', initial: number, update: (value: number) => void, min: number, max: number) {
  event.preventDefault()
  const start = axis === 'x' ? event.clientX : event.clientY
  document.body.classList.add(axis === 'x' ? 'resizing-x' : 'resizing-y')
  const move = (next: PointerEvent) => {
    const cursor = axis === 'x' ? next.clientX : next.clientY
    update(Math.min(max, Math.max(min, initial + cursor - start)))
  }
  const end = () => {
    document.body.classList.remove('resizing-x', 'resizing-y')
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', end)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', end, { once: true })
}
