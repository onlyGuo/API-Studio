<script setup lang="ts">
import { Check } from 'lucide-vue-next'
withDefaults(defineProps<{ modelValue: boolean; label?: string; small?: boolean; disabled?: boolean }>(), { label:'', small:false, disabled:false })
const emit = defineEmits<{ 'update:modelValue':[value:boolean] }>()
</script>
<template><button type="button" class="ui-checkbox" :class="{checked:modelValue,small}" role="checkbox" :aria-checked="modelValue" :disabled="disabled" @click="emit('update:modelValue',!modelValue)"><i><Check v-if="modelValue" :size="small?10:12" stroke-width="3"/></i><span v-if="label">{{ label }}</span></button></template>
