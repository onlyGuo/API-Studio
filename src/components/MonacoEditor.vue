<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted, ref, watch, type ComputedRef } from 'vue'
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

self.MonacoEnvironment = {
  getWorker(_moduleId: string, label: string) {
    if (label === 'json') return new JsonWorker()
    if (label === 'css' || label === 'scss' || label === 'less') return new CssWorker()
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new HtmlWorker()
    if (label === 'typescript' || label === 'javascript') return new TsWorker()
    return new EditorWorker()
  },
}

const props = withDefaults(defineProps<{
  modelValue: string
  language?: string
  readonly?: boolean
  theme?: 'light' | 'dark'
  placeholder?: string
  minimap?: boolean
  wordWrap?: boolean
}>(), { language: 'plaintext', readonly: false, placeholder: '', minimap: false, wordWrap: true })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const preferences = inject<ComputedRef<{ editorFontSize: number }>>('appPreferences')
const host = ref<HTMLElement>()
let editor: monaco.editor.IStandaloneCodeEditor | undefined
let placeholderWidget: monaco.editor.IContentWidget | undefined
let themeObserver: MutationObserver | undefined
let internal = false

const resolvedTheme = () => props.theme || (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')

function syncPlaceholder() {
  if (!editor || !props.placeholder) return
  const id = 'api-studio.placeholder'
  if (!placeholderWidget) {
    const node = document.createElement('div')
    node.className = 'monaco-placeholder'
    node.textContent = props.placeholder
    placeholderWidget = {
      getId: () => id,
      getDomNode: () => node,
      getPosition: () => ({ position: { lineNumber: 1, column: 1 }, preference: [monaco.editor.ContentWidgetPositionPreference.EXACT] }),
    }
  }
  if (editor.getValue()) editor.removeContentWidget(placeholderWidget)
  else editor.addContentWidget(placeholderWidget)
}

onMounted(() => {
  if (!host.value) return
  editor = monaco.editor.create(host.value, {
    value: props.modelValue,
    language: props.language,
    theme: resolvedTheme() === 'dark' ? 'vs-dark' : 'vs',
    readOnly: props.readonly,
    automaticLayout: true,
    minimap: { enabled: props.minimap },
    wordWrap: props.wordWrap ? 'on' : 'off',
    scrollBeyondLastLine: false,
    renderLineHighlight: props.readonly ? 'none' : 'line',
    lineNumbers: props.readonly ? 'off' : 'on',
    folding: !props.readonly,
    glyphMargin: false,
    lineDecorationsWidth: props.readonly ? 8 : 10,
    lineNumbersMinChars: 3,
    overviewRulerBorder: false,
    overviewRulerLanes: 0,
    hideCursorInOverviewRuler: true,
    contextmenu: true,
    fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: preferences?.value.editorFontSize || 12,
    lineHeight: 19,
    padding: { top: 9, bottom: 9 },
    scrollbar: { verticalScrollbarSize: 9, horizontalScrollbarSize: 9 },
  })
  editor.onDidChangeModelContent(() => {
    syncPlaceholder()
    if (!internal) emit('update:modelValue', editor?.getValue() || '')
  })
  syncPlaceholder()
  themeObserver = new MutationObserver(() => monaco.editor.setTheme(resolvedTheme() === 'dark' ? 'vs-dark' : 'vs'))
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
})

watch(() => props.modelValue, value => {
  if (!editor || editor.getValue() === value) return
  internal = true
  editor.setValue(value)
  internal = false
  syncPlaceholder()
})
watch(() => props.language, value => { const model = editor?.getModel(); if (model) monaco.editor.setModelLanguage(model, value) })
watch(() => props.theme, () => monaco.editor.setTheme(resolvedTheme() === 'dark' ? 'vs-dark' : 'vs'))
watch(() => props.readonly, value => editor?.updateOptions({ readOnly: value, lineNumbers: value ? 'off' : 'on', renderLineHighlight: value ? 'none' : 'line' }))
watch(() => preferences?.value.editorFontSize, value => { if (value) editor?.updateOptions({ fontSize: value }) })
onBeforeUnmount(() => { themeObserver?.disconnect(); editor?.dispose() })
</script>

<template><div ref="host" class="monaco-host"></div></template>
