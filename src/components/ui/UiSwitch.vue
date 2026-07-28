<script setup lang="ts">
withDefaults(defineProps<{ modelValue:boolean; label?:string }>(),{label:''})
const emit=defineEmits<{ 'update:modelValue':[value:boolean] }>()
</script>
<template><button type="button" class="ui-switch" :class="{checked:modelValue}" role="switch" :aria-checked="modelValue" @click="emit('update:modelValue',!modelValue)"><i></i><span v-if="label">{{ label }}</span></button></template>
