<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Copy, FilePlus2, FolderInput, FolderPlus, Pencil, Search, Trash2, X } from 'lucide-vue-next'
import type { ApiNode, Environment, Project, RequestData } from '../types'
import { deepClone, emptyRequest, uid } from '../lib'
import ApiTreeNode from './ApiTreeNode.vue'
import RequestWorkbench from './RequestWorkbench.vue'
import { beginResize, persistedSize } from '../resize'
import UiSelect from './ui/UiSelect.vue'

const props = defineProps<{ project: Project; environment: Environment; defaultTimeout: number; focusNodeId?: string }>()
const emit = defineEmits<{ 'update:project': [project: Project]; notify: [message: string]; save: [] }>()
const selectedId = ref(props.project.nodes.find(n => n.type === 'request')?.id || '')
const search = ref('')
const { size: sidebarWidth, set: setSidebarWidth } = persistedSize(`interfaces:${props.project.id}`, 276)
const selected = computed(() => props.project.nodes.find(n => n.id === selectedId.value))
const contextMenu = ref<{ nodeId: string; x: number; y: number } | null>(null)
const dialogMode = ref<'rename'|'move'|'delete'|null>(null)
const dialogNodeId = ref('')
const dialogName = ref('')
const moveTargetId = ref('__root__')
const rootNodes = computed(() => {
  const roots = props.project.nodes.filter(node => node.parentId === null)
  if (!search.value) return roots
  const matches = new Set(props.project.nodes.filter(n => n.name.toLowerCase().includes(search.value.toLowerCase())).map(n => n.id))
  const includeParents = (id: string) => { const node = props.project.nodes.find(n => n.id===id); if (node?.parentId) { matches.add(node.parentId); includeParents(node.parentId) } }
  Array.from(matches).forEach(includeParents)
  return roots.filter(n => matches.has(n.id))
})
const displayedNodes = computed(() => {
  if (!search.value) return props.project.nodes
  const matches = new Set(props.project.nodes.filter(n => n.name.toLowerCase().includes(search.value.toLowerCase())).map(n => n.id))
  const addParents = (id:string) => { const n=props.project.nodes.find(x=>x.id===id); if(n?.parentId){matches.add(n.parentId);addParents(n.parentId)} }; Array.from(matches).forEach(addParents)
  return props.project.nodes.filter(n => matches.has(n.id)).map(n => n.type==='folder'?{...n,expanded:true}:n)
})
function commit(nodes: ApiNode[]) { emit('update:project', { ...props.project, nodes, updatedAt: Date.now() }) }
function create(type: 'request' | 'folder', parentId: string | null = null) {
  const name = type === 'folder' ? '新建目录' : '未命名接口'
  const node: ApiNode = { id: uid(), type, name, parentId, expanded: true, ...(type==='request' ? { request: emptyRequest('GET', props.defaultTimeout) } : {}) }
  const nodes = props.project.nodes.map(n => n.id===parentId ? {...n,expanded:true}:n)
  commit([...nodes, node]); selectedId.value = node.id; emit('notify', type==='folder'?'目录已创建':'接口已创建')
}
function toggle(node: ApiNode) { commit(props.project.nodes.map(n => n.id===node.id ? {...n,expanded:!n.expanded}:n)) }
function descendants(id: string) {
  const result = new Set<string>(); const queue = [id]
  while (queue.length) { const current = queue.shift()!; props.project.nodes.filter(n=>n.parentId===current).forEach(n=>{result.add(n.id);queue.push(n.id)}) }
  return result
}
function uniqueNodeName(name: string, parentId: string | null, excludeId = '') {
  const names = new Set(props.project.nodes.filter(n=>n.parentId===parentId && n.id!==excludeId).map(n=>n.name))
  if (!names.has(name)) return name
  let index=1; let next=`${name} (${index})`; while(names.has(next))next=`${name} (${++index})`; return next
}
function duplicate(node: ApiNode) {
  const childIds=descendants(node.id); const source=props.project.nodes.filter(n=>n.id===node.id||childIds.has(n.id)); const ids=new Map(source.map(n=>[n.id,uid()]))
  const copies=source.map(n=>({ ...deepClone(n), id:ids.get(n.id)!, parentId:n.id===node.id?node.parentId:ids.get(n.parentId!)!, name:n.id===node.id?uniqueNodeName(`${n.name} 副本`,n.parentId):n.name }))
  commit([...props.project.nodes,...copies]); selectedId.value=ids.get(node.id)!; emit('notify',node.type==='folder'?'目录及其内容已复制':'接口已复制')
}
function action(action: string, node: ApiNode) {
  contextMenu.value=null
  if (action === 'request' || action === 'folder') return create(action, node.id)
  if(action==='duplicate'){duplicate(node);return}
  dialogNodeId.value=node.id
  if(action==='rename'){dialogName.value=node.name;dialogMode.value='rename'}
  if(action==='move'){moveTargetId.value=node.parentId||'__root__';dialogMode.value='move'}
  if(action==='delete')dialogMode.value='delete'
}
function confirmDialog(){
  const node=props.project.nodes.find(n=>n.id===dialogNodeId.value);if(!node)return closeDialog()
  if(dialogMode.value==='rename'){
    const name=dialogName.value.trim();if(!name)return
    commit(props.project.nodes.map(n=>n.id===node.id?{...n,name:uniqueNodeName(name,n.parentId,n.id)}:n));emit('notify','名称已更新')
  } else if(dialogMode.value==='move'){
    const parentId=moveTargetId.value==='__root__'?null:moveTargetId.value
    commit(props.project.nodes.map(n=>n.id===node.id?{...n,parentId,name:uniqueNodeName(n.name,parentId,n.id)}:n).map(n=>n.id===parentId?{...n,expanded:true}:n));emit('notify','已移动到目标目录')
  } else if(dialogMode.value==='delete'){
    const remove = new Set([node.id]); let changed=true
    while(changed){changed=false;props.project.nodes.forEach(n=>{if(n.parentId&&remove.has(n.parentId)&&!remove.has(n.id)){remove.add(n.id);changed=true}})}
    commit(props.project.nodes.filter(n=>!remove.has(n.id))); if(remove.has(selectedId.value)) selectedId.value='';emit('notify',node.type==='folder'?'目录及其内容已删除':'接口已删除')
  }
  closeDialog()
}
function closeDialog(){dialogMode.value=null;dialogNodeId.value=''}
const moveOptions=computed(()=>{const blocked=descendants(dialogNodeId.value);blocked.add(dialogNodeId.value);return [{label:'接口集合（根目录）',value:'__root__'},...props.project.nodes.filter(n=>n.type==='folder'&&!blocked.has(n.id)).map(n=>({label:n.name,value:n.id}))]})
function openMenu(node:ApiNode,x:number,y:number){selectedId.value=node.id;contextMenu.value={nodeId:node.id,x:Math.min(x,window.innerWidth-190),y:Math.min(y,window.innerHeight-245)}}
function closeContext(){contextMenu.value=null}
function keyboard(event:KeyboardEvent){const target=event.target as HTMLElement;if(['INPUT','TEXTAREA'].includes(target.tagName)||target.isContentEditable||!selected.value)return;if(event.key==='F2'){event.preventDefault();action('rename',selected.value)}else if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='d'){event.preventDefault();duplicate(selected.value)}else if(event.key==='Delete'||event.key==='Backspace'&&event.metaKey){event.preventDefault();action('delete',selected.value)}}
function updateRequest(request: RequestData) { if(selected.value) commit(props.project.nodes.map(n=>n.id===selected.value?.id?{...n,request}:n)) }
function updateEnvironment(environment:Environment){emit('update:project',{...props.project,environments:props.project.environments.map(item=>item.id===environment.id?environment:item),updatedAt:Date.now()})}
function resizeSidebar(event: PointerEvent) { beginResize(event, 'x', sidebarWidth.value, setSidebarWidth, 190, Math.min(520, window.innerWidth * .45)) }
function focusNode(id?:string){if(!id||!props.project.nodes.some(n=>n.id===id))return;selectedId.value=id;search.value='';const parents=new Set<string>();let current=props.project.nodes.find(n=>n.id===id);while(current?.parentId){parents.add(current.parentId);current=props.project.nodes.find(n=>n.id===current?.parentId)};commit(props.project.nodes.map(n=>parents.has(n.id)?{...n,expanded:true}:n))}
watch(()=>props.focusNodeId,focusNode,{immediate:true})
onMounted(()=>{document.addEventListener('pointerdown',closeContext);document.addEventListener('keydown',keyboard)})
onBeforeUnmount(()=>{document.removeEventListener('pointerdown',closeContext);document.removeEventListener('keydown',keyboard)})
</script>

<template>
  <div class="interface-layout" :style="{ gridTemplateColumns: `${sidebarWidth}px 5px minmax(0, 1fr)` }">
    <aside class="collection-pane">
      <div class="pane-heading"><strong>接口集合</strong><div><button class="icon-btn" title="新建接口" @click="create('request')"><FilePlus2 :size="15" /></button><button class="icon-btn" title="新建目录" @click="create('folder')"><FolderPlus :size="15" /></button></div></div>
      <div class="search-box"><Search :size="14" /><input v-model="search" placeholder="搜索接口" /><button v-if="search" @click="search='' "><X :size="13" /></button></div>
      <div class="tree-list">
        <ApiTreeNode v-for="node in rootNodes" :key="node.id" :node="node" :nodes="displayedNodes" :selected-id="selectedId" @select="selectedId=$event.id" @toggle="toggle" @action="action" @menu="openMenu" />
        <div v-if="!project.nodes.length" class="empty-tree"><FilePlus2 :size="26" /><strong>还没有接口</strong><span>创建目录或接口开始调试</span><button class="soft-btn" @click="create('request')">新建接口</button></div>
      </div>
    </aside>
    <div class="resize-handle vertical" title="拖动调整接口列表宽度" @pointerdown="resizeSidebar"></div>
    <RequestWorkbench v-if="selected?.type==='request' && selected.request" :request="selected.request" :project="project" :environment="environment" :title="selected.name" @update:request="updateRequest" @update:environment="updateEnvironment" @save="emit('save')" />
    <div v-else class="welcome-panel"><div class="welcome-mark">API</div><h2>选择或创建一个接口</h2><p>构建请求、调试认证、检查响应，并为每个项目保存完整上下文。</p><div><button class="primary-btn" @click="create('request')"><FilePlus2 :size="16" /> 新建接口</button><button class="soft-btn" @click="create('folder')"><FolderPlus :size="16" /> 新建目录</button></div><kbd>⌘ N</kbd><span>快速新建接口</span></div>
  </div>
  <Teleport to="body">
    <div v-if="contextMenu" class="context-menu" :style="{left:`${contextMenu.x}px`,top:`${contextMenu.y}px`}" @pointerdown.stop>
      <template v-if="project.nodes.find(n=>n.id===contextMenu?.nodeId)?.type==='folder'"><button @click="action('request',project.nodes.find(n=>n.id===contextMenu!.nodeId)!)"><FilePlus2 :size="14"/>新建接口</button><button @click="action('folder',project.nodes.find(n=>n.id===contextMenu!.nodeId)!)"><FolderPlus :size="14"/>新建目录</button><i></i></template>
      <button @click="action('rename',project.nodes.find(n=>n.id===contextMenu!.nodeId)!)"><Pencil :size="14"/>重命名 <kbd>F2</kbd></button>
      <button @click="action('duplicate',project.nodes.find(n=>n.id===contextMenu!.nodeId)!)"><Copy :size="14"/>复制 <kbd>⌘D</kbd></button>
      <button @click="action('move',project.nodes.find(n=>n.id===contextMenu!.nodeId)!)"><FolderInput :size="14"/>移动到…</button><i></i>
      <button class="danger" @click="action('delete',project.nodes.find(n=>n.id===contextMenu!.nodeId)!)"><Trash2 :size="14"/>删除</button>
    </div>
    <div v-if="dialogMode" class="modal-backdrop" @click.self="closeDialog">
      <form class="modal node-dialog" @submit.prevent="confirmDialog">
        <h2>{{ dialogMode==='rename'?'重命名':dialogMode==='move'?'移动到目录':'确认删除' }}</h2>
        <p v-if="dialogMode==='delete'">{{ project.nodes.find(n=>n.id===dialogNodeId)?.type==='folder'?'目录内的所有接口和子目录也会被删除。':'删除后将无法在应用内撤销。' }}</p>
        <label v-if="dialogMode==='rename'">新名称<input v-model="dialogName" autofocus /></label>
        <label v-else-if="dialogMode==='move'">目标目录<UiSelect v-model="moveTargetId" :options="moveOptions" /></label>
        <div class="modal-actions"><button type="button" class="soft-btn" @click="closeDialog">取消</button><button class="primary-btn" :class="{danger:dialogMode==='delete'}" type="submit">{{ dialogMode==='delete'?'删除':'确定' }}</button></div>
      </form>
    </div>
  </Teleport>
</template>
