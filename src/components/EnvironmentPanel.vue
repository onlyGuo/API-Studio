<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check, CircleHelp, Copy, Globe2, Pencil, Plus, Trash2 } from 'lucide-vue-next'
import type { Environment, Project } from '../types'
import { deepClone, row, uid } from '../lib'
import KeyValueEditor from './KeyValueEditor.vue'
import { beginResize, persistedSize } from '../resize'

const props = defineProps<{ project: Project; focusId?: string }>()
const emit = defineEmits<{ 'update:project': [project: Project]; notify: [message:string] }>()
const activeId = ref(props.project.activeEnvironmentId)
const tab = ref<'variables'|'headers'>('variables')
const { size: sidebarWidth, set: setSidebarWidth } = persistedSize(`environments:${props.project.id}`, 250)
const active = computed(() => props.project.environments.find(e=>e.id===activeId.value) || props.project.environments[0])
const dialogMode=ref<'rename'|'delete'|null>(null)
const nameDraft=ref('')
function commit(environments: Environment[], extra: Partial<Project> = {}) { emit('update:project',{...props.project,environments,updatedAt:Date.now(),...extra}) }
function update(env: Environment) { commit(props.project.environments.map(e=>e.id===env.id?env:e)) }
function uniqueName(name:string){const names=new Set(props.project.environments.filter(e=>e.id!==active.value.id).map(e=>e.name));let next=name,index=1;while(names.has(next))next=`${name} (${index++})`;return next}
function add() { const id=uid();commit([...props.project.environments,{id,name:`新环境 ${props.project.environments.length+1}`,variables:[row()],headers:[row()]}],{activeEnvironmentId:id});activeId.value=id;emit('notify','环境已创建') }
function rename() { nameDraft.value=active.value.name;dialogMode.value='rename' }
function duplicate(){const copy=deepClone(active.value);copy.id=uid();copy.name=uniqueName(`${copy.name} 副本`);copy.variables=copy.variables.map(v=>({...v,id:uid()}));copy.headers=copy.headers.map(v=>({...v,id:uid()}));commit([...props.project.environments,copy]);activeId.value=copy.id;emit('notify','环境已复制')}
function remove() { if(props.project.environments.length===1)return;dialogMode.value='delete' }
function confirmDialog(){if(dialogMode.value==='rename'){const name=nameDraft.value.trim();if(!name)return;update({...active.value,name:uniqueName(name)});emit('notify','环境已重命名')}else{const list=props.project.environments.filter(e=>e.id!==active.value.id);const next=list[0];activeId.value=next.id;commit(list,{activeEnvironmentId:props.project.activeEnvironmentId===active.value.id?next.id:props.project.activeEnvironmentId});emit('notify','环境已删除')}dialogMode.value=null}
function activate() { commit(props.project.environments,{activeEnvironmentId:active.value.id}) }
function resizeSidebar(event: PointerEvent) { beginResize(event,'x',sidebarWidth.value,setSidebarWidth,185,460) }
watch(()=>props.focusId,id=>{if(id&&props.project.environments.some(e=>e.id===id))activeId.value=id},{immediate:true})
</script>

<template>
  <div class="module-layout" :style="{gridTemplateColumns:`${sidebarWidth}px 5px minmax(0,1fr)`}">
    <aside class="module-list">
      <div class="pane-heading"><strong>环境</strong><button class="icon-btn" @click="add"><Plus :size="15" /></button></div>
      <p class="side-caption">为不同部署保存变量和公共 Header</p>
      <button v-for="env in project.environments" :key="env.id" class="module-list-item" :class="{active:env.id===active.id}" @click="activeId=env.id"><Globe2 :size="16" /><span>{{ env.name }}</span><i v-if="env.id===project.activeEnvironmentId" title="当前环境"><Check :size="13" /></i></button>
    </aside>
    <div class="resize-handle vertical" title="拖动调整环境列表宽度" @pointerdown="resizeSidebar"></div>
    <main class="module-content">
      <header class="module-header"><div><span class="eyebrow">PROJECT ENVIRONMENT</span><h1 @dblclick="rename">{{ active.name }}</h1><p>接口发送前会解析这里的变量，并自动附加公共 Header。</p></div><div><button v-if="active.id!==project.activeEnvironmentId" class="soft-btn" @click="activate"><Check :size="15" />设为当前环境</button><button class="icon-btn" title="重命名环境" @click="rename"><Pencil :size="16"/></button><button class="icon-btn" title="复制环境" @click="duplicate"><Copy :size="16"/></button><button class="icon-btn danger-hover" title="删除环境" :disabled="project.environments.length===1" @click="remove"><Trash2 :size="16" /></button></div></header>
      <div class="segmented-tabs"><button :class="{active:tab==='variables'}" @click="tab='variables'">环境变量 <em>{{ active.variables.filter(v=>v.key).length }}</em></button><button :class="{active:tab==='headers'}" @click="tab='headers'">公共 Header <em>{{ active.headers.filter(v=>v.key).length }}</em></button></div>
      <section class="content-card">
        <div v-if="tab==='variables'" class="section-intro"><div><h3>环境变量</h3><p>使用 <code v-pre>{{变量名}}</code> 引用；变量值本身也可以继续引用其他变量或脚本输出。</p></div><CircleHelp :size="18" /></div>
        <div v-else class="section-intro"><div><h3>公共 Header</h3><p>自动应用于当前环境下的所有接口；接口 Header 可覆盖它，或与它重复传入。</p></div><CircleHelp :size="18" /></div>
        <KeyValueEditor v-if="tab==='variables'" :model-value="active.variables" @update:model-value="update({...active,variables:$event as any})" />
        <KeyValueEditor v-else :model-value="active.headers" @update:model-value="update({...active,headers:$event as any})" />
      </section>
      <div class="tip-card"><strong>优先级规则</strong><span>脚本输出 → 环境变量 → 请求参数解析；同名接口 Header 默认覆盖公共 Header。</span></div>
    </main>
    <div v-if="dialogMode" class="modal-backdrop" @click.self="dialogMode=null"><form class="modal" @submit.prevent="confirmDialog"><h2>{{ dialogMode==='rename'?'重命名环境':'删除环境' }}</h2><p v-if="dialogMode==='delete'">将删除“{{ active.name }}”中的所有变量和公共 Header。</p><label v-else>环境名称<input v-model="nameDraft" autofocus/></label><div class="modal-actions"><button type="button" class="soft-btn" @click="dialogMode=null">取消</button><button class="primary-btn" :class="{danger:dialogMode==='delete'}" type="submit">{{ dialogMode==='delete'?'删除':'确定' }}</button></div></form></div>
  </div>
</template>
