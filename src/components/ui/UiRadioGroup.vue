<script setup lang="ts">
export interface RadioOption { label:string; value:string }
defineProps<{ modelValue:string; options:RadioOption[] }>()
const emit=defineEmits<{ 'update:modelValue':[value:string] }>()
</script>
<template><div class="ui-radio-group" role="radiogroup"><button v-for="option in options" :key="option.value" type="button" class="ui-radio" :class="{checked:modelValue===option.value}" role="radio" :aria-checked="modelValue===option.value" @click="emit('update:modelValue',option.value)"><i><span></span></i>{{ option.label }}</button></div></template>
