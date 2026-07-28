import type { SseEvent } from './types'

export type ParserMode = 'standard-sse' | 'data-stream'

export class EventStreamParser {
  private buffer = ''
  private index = 0
  private currentEvent = 'message'
  private currentId = ''

  constructor(private mode: ParserMode, private onEvent: (event: SseEvent) => void) {}

  push(chunk: string) {
    this.buffer += chunk.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    if (this.mode === 'standard-sse') this.drainStandard(false)
    else this.drainDataLines(false)
  }

  finish() {
    if (this.mode === 'standard-sse') this.drainStandard(true)
    else this.drainDataLines(true)
  }

  private drainStandard(final: boolean) {
    let boundary = this.buffer.indexOf('\n\n')
    while (boundary >= 0) {
      const block = this.buffer.slice(0, boundary)
      this.buffer = this.buffer.slice(boundary + 2)
      this.emitBlock(block)
      boundary = this.buffer.indexOf('\n\n')
    }
    if (final && this.buffer.trim()) {
      this.emitBlock(this.buffer)
      this.buffer = ''
    }
  }

  private drainDataLines(final: boolean) {
    const lines = this.buffer.split('\n')
    if (!final) this.buffer = lines.pop() || ''
    else this.buffer = ''
    for (const raw of lines) {
      const line = raw.trimEnd()
      if (!line || line.startsWith(':')) continue
      if (line.startsWith('event:')) { this.currentEvent = line.slice(6).trim() || 'message'; continue }
      if (line.startsWith('id:')) { this.currentId = line.slice(3).trim(); continue }
      if (line.startsWith('retry:')) continue
      const data = line.startsWith('data:') ? line.slice(5).trimStart() : line
      this.emit({ event: this.currentEvent, data, id: this.currentId || undefined, raw })
    }
    if (final && this.buffer.trim()) this.emit({ event: this.currentEvent, data: this.buffer.trim(), id: this.currentId || undefined, raw: this.buffer })
  }

  private emitBlock(block: string) {
    if (!block.trim()) return
    let event = 'message'; let id: string | undefined; let retry: number | undefined
    const data: string[] = []
    for (const line of block.split('\n')) {
      if (!line || line.startsWith(':')) continue
      const colon = line.indexOf(':')
      const field = colon < 0 ? line : line.slice(0, colon)
      let value = colon < 0 ? '' : line.slice(colon + 1)
      if (value.startsWith(' ')) value = value.slice(1)
      if (field === 'event') event = value || 'message'
      else if (field === 'data') data.push(value)
      else if (field === 'id') id = value
      else if (field === 'retry' && /^\d+$/.test(value)) retry = Number(value)
      else if (colon < 0 || !['event', 'id', 'retry'].includes(field)) data.push(line)
    }
    if (data.length || event !== 'message' || id) this.emit({ event, data: data.join('\n'), id, retry, raw: block })
  }

  private emit(input: Omit<SseEvent, 'index' | 'timestamp'>) {
    this.onEvent({ ...input, index: ++this.index, timestamp: Date.now() })
  }
}

export function prettyData(value: string) {
  try { return JSON.stringify(JSON.parse(value), null, 2) } catch { return value }
}
