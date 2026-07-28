<script setup lang="ts">
import { ChevronDown, ChevronRight, FileJson2, Folder, FolderOpen, MoreHorizontal } from 'lucide-vue-next'
import type { ApiNode } from '../types'

defineOptions({ name: 'ApiTreeNode' })
const props = defineProps<{ node: ApiNode; nodes: ApiNode[]; selectedId: string; depth?: number }>()
const emit = defineEmits<{
  select: [node: ApiNode]
  toggle: [node: ApiNode]
  action: [action: 'rename', node: ApiNode]
  menu: [node: ApiNode, x: number, y: number]
}>()
const children = () => props.nodes.filter(item => item.parentId === props.node.id)
function openMenu(event: MouseEvent) {
  event.preventDefault(); event.stopPropagation()
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  emit('menu', props.node, event.type === 'contextmenu' ? event.clientX : rect.right, event.type === 'contextmenu' ? event.clientY : rect.bottom)
}
</script>

<template>
  <div class="tree-node">
    <div class="tree-row" :class="{ selected: selectedId===node.id }" :style="{ paddingLeft: `${8 + (depth || 0) * 15}px` }" @click="emit('select', node)" @dblclick="emit('action','rename',node)" @contextmenu="openMenu">
      <button v-if="node.type==='folder'" class="tree-chevron" @click.stop="emit('toggle', node)"><ChevronDown v-if="node.expanded" :size="13" /><ChevronRight v-else :size="13" /></button>
      <span v-else class="tree-spacer"></span>
      <FolderOpen v-if="node.type==='folder' && node.expanded" class="folder-icon" :size="15" />
      <Folder v-else-if="node.type==='folder'" class="folder-icon" :size="15" />
      <FileJson2 v-else :size="15" class="request-icon" />
      <span v-if="node.type==='request'" class="tree-method" :class="node.request?.method.toLowerCase()">{{ node.request?.method.slice(0,3) }}</span>
      <span class="tree-label">{{ node.name }}</span>
      <button class="tree-more" title="更多操作" @click="openMenu"><MoreHorizontal :size="14" /></button>
    </div>
    <template v-if="node.type==='folder' && node.expanded">
      <ApiTreeNode v-for="child in children()" :key="child.id" :node="child" :nodes="nodes" :selected-id="selectedId" :depth="(depth || 0)+1" @select="emit('select',$event)" @toggle="emit('toggle',$event)" @action="(action,n)=>emit('action',action,n)" @menu="(node,x,y)=>emit('menu',node,x,y)" />
    </template>
  </div>
</template>
