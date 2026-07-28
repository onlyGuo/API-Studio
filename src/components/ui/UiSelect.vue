<script setup lang="ts">
import { Check, ChevronDown } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

export interface SelectOption { label: string; value: string; description?: string }
const props = withDefaults(defineProps<{
  modelValue: string
  options: SelectOption[]
  placeholder?: string
  compact?: boolean
  tone?: string
}>(), { placeholder: '请选择', compact: false, tone: '' })
const emit = defineEmits<{ 'update:modelValue': [value: string]; change: [value: string] }>()
const button = ref<HTMLElement>()
const popup = ref<HTMLElement>()
const open = ref(false)
const activeIndex = ref(0)
const popupStyle = ref<Record<string,string>>({})
const selected = computed(() => props.options.find(option => option.value === props.modelValue))

async function position() {
  const rect = button.value?.getBoundingClientRect()
  if (!rect) return
  popupStyle.value = { left: `${rect.left}px`, top: `${rect.bottom + 4}px`, minWidth: `${Math.max(rect.width, 150)}px` }
  await nextTick()
  const height = popup.value?.getBoundingClientRect().height || 0
  if (rect.bottom + height + 8 > window.innerHeight && rect.top > height) popupStyle.value.top = `${rect.top - height - 4}px`
}
function toggle() {
  open.value = !open.value
  if (open.value) { activeIndex.value = Math.max(0, props.options.findIndex(o => o.value === props.modelValue)); void position() }
}
function choose(value: string) {
  emit('update:modelValue', value); emit('change', value); open.value = false; button.value?.focus()
}
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { open.value = false; return }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    if (!open.value) toggle()
    else choose(props.options[activeIndex.value]?.value || props.modelValue)
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (!open.value) { toggle(); return }
    const delta = event.key === 'ArrowDown' ? 1 : -1
    activeIndex.value = (activeIndex.value + delta + props.options.length) % props.options.length
  }
}
function outside(event: PointerEvent) {
  const target = event.target as Node
  if (!button.value?.contains(target) && !popup.value?.contains(target)) open.value = false
}
const close = () => { open.value = false }
onMounted(() => { document.addEventListener('pointerdown', outside); window.addEventListener('resize', close, { passive:true }); window.addEventListener('scroll', close, true) })
onBeforeUnmount(() => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', close); window.removeEventListener('scroll', close, true) })
</script>

<template>
  <div class="ui-select" :class="{open,compact}">
    <button ref="button" type="button" class="ui-select-trigger" :class="tone || modelValue.toLowerCase()" role="combobox" :aria-expanded="open" aria-haspopup="listbox" @click.stop="toggle" @keydown="keydown">
      <span>{{ selected?.label || placeholder }}</span><ChevronDown :size="13"/>
    </button>
    <Teleport to="body">
      <div v-if="open" ref="popup" class="ui-select-popup" :style="popupStyle" role="listbox">
        <button v-for="(option,index) in options" :key="option.value" type="button" class="ui-select-option" :class="{selected:option.value===modelValue,highlighted:index===activeIndex}" role="option" :aria-selected="option.value===modelValue" @pointerenter="activeIndex=index" @click="choose(option.value)">
          <span><b>{{ option.label }}</b><small v-if="option.description">{{ option.description }}</small></span><Check v-if="option.value===modelValue" :size="14"/>
        </button>
      </div>
    </Teleport>
  </div>
</template>
