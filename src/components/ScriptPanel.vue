<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CheckCircle2, Clock3, Copy, FileCode2, LoaderCircle, Play, Plus, RefreshCw, Trash2, Zap } from 'lucide-vue-next'
import type { Environment, Project, RequestData, ScriptItem } from '../types'
import { deepClone, emptyRequest, getByPath, runScript, uid } from '../lib'
import RequestWorkbench from './RequestWorkbench.vue'
import { beginResize, persistedSize } from '../resize'
import UiNumber from './ui/UiNumber.vue'

const props = defineProps<{ project: Project; defaultTimeout: number; focusId?: string }>()
const emit = defineEmits<{ 'update:project': [project: Project]; notify: [message:string] }>()
const selectedId = ref(props.project.scripts[0]?.id || '')
const running = ref(false)
const lastMessage = ref('')
const deleteDialog=ref(false)
const { size: sidebarWidth, set: setSidebarWidth } = persistedSize(`scripts:${props.project.id}`, 260)
const active = computed(() => props.project.scripts.find(s=>s.id===selectedId.value))
const environment = computed(() => props.project.environments.find(e=>e.id===props.project.activeEnvironmentId) || props.project.environments[0])
function commit(scripts: ScriptItem[]) { emit('update:project',{...props.project,scripts,updatedAt:Date.now()}) }
function add() { const script:ScriptItem={id:uid(),name:'获取登录 Token',request:{...emptyRequest('POST',props.defaultTimeout),bodyMode:'json',body:'{\n  "username": "admin",\n  "password": "password"\n}'},outputPath:'$.token',outputVariable:'token',ttlMinutes:60};commit([...props.project.scripts,script]);selectedId.value=script.id;emit('notify','脚本已创建') }
function update(script: ScriptItem) { commit(props.project.scripts.map(s=>s.id===script.id?script:s)) }
function updateRequest(request: RequestData) { if(active.value)update({...active.value,request}) }
function updateEnvironment(environment:Environment){emit('update:project',{...props.project,environments:props.project.environments.map(item=>item.id===environment.id?environment:item),updatedAt:Date.now()})}
function duplicate(){if(!active.value)return;const copy=deepClone(active.value);copy.id=uid();copy.name=`${copy.name} 副本`;copy.cache=undefined;commit([...props.project.scripts,copy]);selectedId.value=copy.id;emit('notify','脚本已复制')}
function remove() { if(!active.value)return;deleteDialog.value=true }
function confirmRemove(){if(!active.value)return;const id=active.value.id;commit(props.project.scripts.filter(s=>s.id!==id));selectedId.value=props.project.scripts.find(s=>s.id!==id)?.id||'';deleteDialog.value=false;emit('notify','脚本已删除')}
async function execute(force=true) {
  if(!active.value || running.value)return
  if(!force && active.value.cache && active.value.cache.expiresAt>Date.now()){lastMessage.value='缓存仍在有效期内';return}
  running.value=true;lastMessage.value=''
  try {
    const response=await runScript(active.value,props.project,environment.value)
    if(!response.ok) throw new Error(response.error || '请求失败')
    let parsed:unknown=response.body
    try{parsed=JSON.parse(response.body||'')}catch{}
    const value=getByPath(parsed,active.value.outputPath)
    if(value===undefined)throw new Error(`在响应中找不到 ${active.value.outputPath}`)
    update({...active.value,cache:{value,updatedAt:Date.now(),expiresAt:Date.now()+active.value.ttlMinutes*60_000}})
    lastMessage.value='执行成功，输出已更新'
  } catch(error){lastMessage.value=error instanceof Error?error.message:String(error)} finally{running.value=false}
}
function remain(script:ScriptItem){if(!script.cache)return '未执行';const ms=script.cache.expiresAt-Date.now();if(ms<=0)return '已过期';if(ms<60_000)return '< 1 分钟';return `${Math.ceil(ms/60_000)} 分钟`}
function resizeSidebar(event: PointerEvent){beginResize(event,'x',sidebarWidth.value,setSidebarWidth,195,480)}
watch(()=>props.focusId,id=>{if(id&&props.project.scripts.some(s=>s.id===id))selectedId.value=id},{immediate:true})
</script>

<template>
  <div class="module-layout script-module" :style="{gridTemplateColumns:`${sidebarWidth}px 5px minmax(0,1fr)`}">
    <aside class="module-list">
      <div class="pane-heading"><strong>自动化脚本</strong><button class="icon-btn" @click="add"><Plus :size="15" /></button></div>
      <p class="side-caption">自动请求并提取可复用的动态值</p>
      <button v-for="script in project.scripts" :key="script.id" class="module-list-item script-item" :class="{active:script.id===selectedId}" @click="selectedId=script.id"><FileCode2 :size="16" /><span><b>{{ script.name }}</b><small><i :class="{valid:script.cache && script.cache.expiresAt>Date.now()}"/>{{ remain(script) }}</small></span></button>
      <div v-if="!project.scripts.length" class="empty-tree"><Zap :size="26" /><strong>暂无脚本</strong><span>创建登录、刷新令牌等自动请求</span><button class="soft-btn" @click="add">创建脚本</button></div>
    </aside>
    <div class="resize-handle vertical" title="拖动调整脚本列表宽度" @pointerdown="resizeSidebar"></div>
    <main v-if="active" class="script-content">
      <header class="script-header"><div><span class="eyebrow">AUTOMATION SCRIPT</span><input :value="active.name" @input="update({...active,name:($event.target as HTMLInputElement).value})" /></div><div class="script-status"><span v-if="active.cache" :class="{fresh:active.cache.expiresAt>Date.now()}"><Clock3 :size="14" />{{ remain(active) }}</span><button class="soft-btn" @click="execute(true)"><LoaderCircle v-if="running" class="spin" :size="15"/><RefreshCw v-else-if="active.cache" :size="15"/><Play v-else :size="15"/>{{ active.cache?'更新':'执行' }}</button><button class="icon-btn" title="复制脚本" @click="duplicate"><Copy :size="16"/></button><button class="icon-btn danger-hover" title="删除脚本" @click="remove"><Trash2 :size="16"/></button></div></header>
      <div class="script-config">
        <label>输出 JSONPath<input :value="active.outputPath" placeholder="$.data.token" @input="update({...active,outputPath:($event.target as HTMLInputElement).value})" /></label>
        <label>保存为变量<input :value="active.outputVariable" placeholder="token" @input="update({...active,outputVariable:($event.target as HTMLInputElement).value})" /></label>
        <label>有效期（分钟）<UiNumber :model-value="active.ttlMinutes" :min="0" :step="5" suffix="min" @update:model-value="update({...active,ttlMinutes:$event})"/></label>
        <div v-if="active.cache" class="output-preview"><span>当前输出</span><code>{{ typeof active.cache.value==='string'?active.cache.value:JSON.stringify(active.cache.value) }}</code></div>
      </div>
      <div v-if="lastMessage" class="run-message" :class="{success:lastMessage.includes('成功')}"><CheckCircle2 :size="15"/>{{ lastMessage }}</div>
      <RequestWorkbench :request="active.request" :project="project" :environment="environment" embedded @update:request="updateRequest" @update:environment="updateEnvironment" />
    </main>
    <div v-else class="welcome-panel"><div class="welcome-mark"><Zap :size="34"/></div><h2>创建你的第一个自动化脚本</h2><p>像普通接口一样发送请求，再用 JSONPath 提取输出供环境变量和公共 Header 使用。</p><button class="primary-btn" @click="add"><Plus :size="16"/>创建脚本</button></div>
    <div v-if="deleteDialog" class="modal-backdrop" @click.self="deleteDialog=false"><form class="modal" @submit.prevent="confirmRemove"><h2>删除脚本</h2><p>将删除“{{ active?.name }}”以及它缓存的输出值。</p><div class="modal-actions"><button type="button" class="soft-btn" @click="deleteDialog=false">取消</button><button class="primary-btn danger" type="submit">删除</button></div></form></div>
  </div>
</template>
