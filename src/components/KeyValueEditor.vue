<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next'
import type { ApiHeader, KeyValue } from '../types'
import { row } from '../lib'
import UiCheckbox from './ui/UiCheckbox.vue'
import UiSelect from './ui/UiSelect.vue'

const props = withDefaults(defineProps<{
  modelValue: Array<KeyValue | ApiHeader>
  headerMode?: boolean
  readonlySource?: string
}>(), { headerMode: false, readonlySource: '' })
const emit = defineEmits<{ 'update:modelValue': [value: Array<KeyValue | ApiHeader>] }>()
const conflictOptions = [{label:'覆盖公共值',value:'override'},{label:'重复传入',value:'append'}]

function update(index: number, field: string, value: string | boolean) {
  const next: Array<KeyValue | ApiHeader> = props.modelValue.map((item, i) => i === index ? { ...item, [field]: value } : item)
  if (index === next.length - 1 && (next[index].key || next[index].value)) next.push(props.headerMode ? { ...row(), conflict: 'override' } : row())
  emit('update:modelValue', next)
}
function remove(index: number) {
  const next = props.modelValue.filter((_, i) => i !== index)
  emit('update:modelValue', next.length ? next : [props.headerMode ? { ...row(), conflict: 'override' } : row()])
}
</script>

<template>
  <div class="kv-table">
    <div class="kv-head" :class="{ 'with-conflict': headerMode }">
      <span></span><span>名称</span><span>值</span><span v-if="headerMode">同名策略</span><span>说明</span><span></span>
    </div>
    <div v-for="(item, index) in modelValue" :key="item.id" class="kv-row" :class="{ 'with-conflict': headerMode }">
      <UiCheckbox small :model-value="item.enabled" @update:model-value="update(index,'enabled',$event)" />
      <input :value="item.key" placeholder="Key" @input="update(index, 'key', ($event.target as HTMLInputElement).value)" />
      <input :value="item.value" placeholder="Value，支持 {{变量}}" @input="update(index, 'value', ($event.target as HTMLInputElement).value)" />
      <UiSelect v-if="headerMode" compact :model-value="(item as ApiHeader).conflict" :options="conflictOptions" @update:model-value="update(index,'conflict',$event)" />
      <input :value="item.description" placeholder="可选说明" @input="update(index, 'description', ($event.target as HTMLInputElement).value)" />
      <button class="icon-btn subtle" title="删除" @click="remove(index)"><Trash2 :size="14" /></button>
    </div>
    <button class="inline-add" @click="emit('update:modelValue', [...modelValue, headerMode ? { ...row(), conflict: 'override' } : row()])"><Plus :size="14" /> 添加一行</button>
  </div>
</template>
