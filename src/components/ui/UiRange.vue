<script setup lang="ts">
import { computed, ref } from 'vue'
const props=withDefaults(defineProps<{modelValue:number;min?:number;max?:number;step?:number}>(),{min:0,max:100,step:1})
const emit=defineEmits<{ 'update:modelValue':[value:number] }>()
const host=ref<HTMLElement>()
const percent=computed(()=>((props.modelValue-props.min)/(props.max-props.min))*100)
function setAt(clientX:number){const rect=host.value?.getBoundingClientRect();if(!rect)return;const raw=props.min+Math.min(1,Math.max(0,(clientX-rect.left)/rect.width))*(props.max-props.min);emit('update:modelValue',Math.round(raw/props.step)*props.step)}
function start(event:PointerEvent){setAt(event.clientX);const move=(e:PointerEvent)=>setAt(e.clientX);const end=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end)};window.addEventListener('pointermove',move);window.addEventListener('pointerup',end,{once:true})}
function keydown(event:KeyboardEvent){if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();emit('update:modelValue',Math.min(props.max,Math.max(props.min,props.modelValue+(event.key==='ArrowRight'?props.step:-props.step))))}
</script>
<template><div ref="host" class="ui-range" role="slider" tabindex="0" :aria-valuemin="min" :aria-valuemax="max" :aria-valuenow="modelValue" @pointerdown="start" @keydown="keydown"><i :style="{width:`${percent}%`}"></i><b :style="{left:`${percent}%`}"></b></div></template>
