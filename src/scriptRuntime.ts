import type { Environment, RequestData, ResponseData, TestResult } from './types'
import { deepClone, variableMap } from './lib'
import type { Project } from './types'

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (...args: string[]) => (...values: unknown[]) => Promise<void>

function expectation(actual: unknown) {
  const fail = (message: string) => { throw new Error(message) }
  const equal = (expected: unknown) => { if (actual !== expected) fail(`期望 ${JSON.stringify(expected)}，实际为 ${JSON.stringify(actual)}`) }
  return {
    to: {
      equal,
      eql: (expected: unknown) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(`期望 ${JSON.stringify(expected)}，实际为 ${JSON.stringify(actual)}`) },
      be: {
        ok: () => { if (!actual) fail('期望值为真') },
        true: () => equal(true),
        false: () => equal(false),
      },
      have: {
        property: (key: string, ...expected: unknown[]) => {
          if (!actual || typeof actual !== 'object' || !(key in actual)) fail(`缺少属性 ${key}`)
          if (expected.length && (actual as Record<string, unknown>)[key] !== expected[0]) fail(`属性 ${key} 的值不匹配`)
        },
      },
    },
  }
}

function variableApi(values: Record<string, string>, onSet?: (key:string,value:string)=>void, onUnset?: (key:string)=>void) {
  return {
    get: (key: string) => values[key],
    set: (key: string, value: unknown) => { const resolved=typeof value === 'string' ? value : JSON.stringify(value);values[key]=resolved;onSet?.(key,resolved) },
    unset: (key: string) => { delete values[key];onUnset?.(key) },
    has: (key: string) => key in values,
    toObject: () => ({ ...values }),
  }
}

export async function runPreRequest(code: string, request: RequestData, project: Project, environment: Environment) {
  const values = variableMap(project, environment)
  const environmentChanges:Record<string,string|undefined>={}
  if (!code.trim()) return { values, environmentChanges }
  const pm = {
    environment: variableApi(values,(key,value)=>environmentChanges[key]=value,key=>environmentChanges[key]=undefined),
    variables: variableApi(values),
    request: deepClone(request),
  }
  await new AsyncFunction('pm', 'console', `"use strict";\n${code}`)(pm, console)
  return { values, environmentChanges }
}

export async function runTests(code: string, response: ResponseData): Promise<TestResult[]> {
  if (!code.trim()) return []
  const results: TestResult[] = []
  const headers = Object.fromEntries(response.headers || [])
  const pm = {
    response: {
      code: response.status,
      status: response.statusText,
      headers,
      text: () => response.body || '',
      json: () => JSON.parse(response.body || ''),
      responseTime: response.time,
    },
    expect: expectation,
    test: (name: string, test: () => unknown) => {
      try { test(); results.push({ name, passed: true }) }
      catch (error) { results.push({ name, passed: false, error: error instanceof Error ? error.message : String(error) }) }
    },
  }
  try { await new AsyncFunction('pm', 'console', `"use strict";\n${code}`)(pm, console) }
  catch (error) { results.push({ name: '测试脚本执行', passed: false, error: error instanceof Error ? error.message : String(error) }) }
  return results
}
