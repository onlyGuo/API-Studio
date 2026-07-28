<script setup lang="ts">
import { Minus, Plus } from 'lucide-vue-next'
const props=withDefaults(defineProps<{modelValue:number;min?:number;max?:number;step?:number;suffix?:string}>(),{min:-Infinity,max:Infinity,step:1,suffix:''})
const emit=defineEmits<{ 'update:modelValue':[value:number] }>()
const set=(value:number)=>emit('update:modelValue',Math.min(props.max,Math.max(props.min,value)))
</script>
<template><div class="ui-number"><input type="text" inputmode="numeric" :value="modelValue" @input="set(Number(($event.target as HTMLInputElement).value)||0)"/><span v-if="suffix">{{ suffix }}</span><div><button type="button" @click="set(modelValue+step)"><Plus :size="10"/></button><button type="button" @click="set(modelValue-step)"><Minus :size="10"/></button></div></div></template>
