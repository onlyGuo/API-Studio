<script setup lang="ts">
import { Activity, Box, Clock3, FileCode2, FolderTree, Globe2, Hash, Layers3 } from 'lucide-vue-next'
import type { Environment, Project } from '../types'

const props = defineProps<{ project: Project; environment: Environment }>()
const emit = defineEmits<{ navigate: [section: 'interfaces'|'environment'|'scripts'] }>()
const requests = () => props.project.nodes.filter(node => node.type === 'request')
const validScripts = () => props.project.scripts.filter(script => script.cache && script.cache.expiresAt > Date.now()).length
</script>

<template>
  <main class="overview-panel">
    <header class="overview-header"><div><span class="eyebrow">PROJECT OVERVIEW</span><h1>{{ project.name }}</h1><p>查看当前项目的数据规模、运行环境和自动化状态。</p></div><div class="uuid-chip"><Hash :size="13"/>{{ project.id }}</div></header>
    <section class="overview-stats">
      <button @click="emit('navigate','interfaces')"><i class="blue"><Box :size="20"/></i><span><b>{{ requests().length }}</b><small>接口请求</small></span></button>
      <button @click="emit('navigate','interfaces')"><i class="amber"><FolderTree :size="20"/></i><span><b>{{ project.nodes.filter(n=>n.type==='folder').length }}</b><small>接口目录</small></span></button>
      <button @click="emit('navigate','environment')"><i class="green"><Globe2 :size="20"/></i><span><b>{{ project.environments.length }}</b><small>项目环境</small></span></button>
      <button @click="emit('navigate','scripts')"><i class="purple"><FileCode2 :size="20"/></i><span><b>{{ project.scripts.length }}</b><small>自动化脚本</small></span></button>
    </section>
    <div class="overview-grid">
      <section class="overview-card"><header><div><Layers3 :size="16"/><strong>最近接口</strong></div><button @click="emit('navigate','interfaces')">查看全部</button></header><div v-if="requests().length" class="recent-list"><div v-for="node in requests().slice(-6).reverse()" :key="node.id"><span class="method-mini" :class="node.request?.method.toLowerCase()">{{ node.request?.method }}</span><b>{{ node.name }}</b><code>{{ node.request?.url || '未设置 URL' }}</code></div></div><div v-else class="overview-empty">暂无接口</div></section>
      <section class="overview-card project-health"><header><div><Activity :size="16"/><strong>项目状态</strong></div></header><div class="health-row"><span><Globe2 :size="15"/>当前环境</span><b>{{ environment.name }}</b></div><div class="health-row"><span><FileCode2 :size="15"/>有效脚本缓存</span><b>{{ validScripts() }} / {{ project.scripts.length }}</b></div><div class="health-row"><span><Clock3 :size="15"/>最后更新</span><b>{{ new Date(project.updatedAt).toLocaleString() }}</b></div><div class="health-note">项目内容会自动保存到本地，无需手动提交。</div></section>
    </div>
  </main>
</template>
