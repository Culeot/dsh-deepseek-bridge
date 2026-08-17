/**
 * DSH DeepSeek Bridge 插件
 * 
 * 核心规则:用户每发一句话,先辩证判断是否需要找 V4
 * 
 * 判断框架:
 * 1.【条件】当前任务需要什么?(知识/推理/方案/执行)
 * 2.【主要矛盾】是"知识/推理"还是"执行"?
 * 3.【规律】V4 强在推理和方案,弱在无工具;龙猫强在有工具,弱在推理深度
 * 4.【一分为二】找 V4 获得深度方案,但消耗时间;不找 V4 快速响应,但可能方案不够优雅
 * 
 * 决策规则:
 * - 简单任务(<10行代码/纯信息查询)→ 龙猫自己做,不问 V4
 * - 复杂架构/策略/方案 → 问 V4,获取辩证分析
 * - 代码执行/文件操作 → 龙猫自己做,V4 无工具
 */

'use strict'

const { SessionManager } = require('./src/session')
const sessions = new SessionManager()

const name = 'deepseek-bridge'
const inject = ['tools']

function apply(ctx) {
  // 注册工具:向 DeepSeek V4 Pro 提问
  ctx.tools.register({
    name: 'ask_ds',
    description: '向 DeepSeek 网页端 V4 Pro 提问,获取架构方案。用于复杂任务需要深度推理时。',
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: '要提问的内容(需包含完整上下文和辩证思维框架)' },
        project: { type: 'string', description: '项目名称(用于会话复用)' },
        requireJson: { type: 'boolean', description: '是否要求 JSON 输出', default: true }
      },
      required: ['question']
    },
    execute: async (args) => {
      // 浏览器自动化无法在 DSH 工具调用中完成,需要通过 CLI
      const project = args.project || 'default'
      const question = args.question.replace(/"/g, '\\"')
      return {
        content: [{
          type: 'text',
          text: `请执行: node src/index.js --project "${project}" "${question}"`
        }]
      }
    }
  })

  // 注册工具:列出 V4 会话
  ctx.tools.register({
    name: 'list_ds_sessions',
    description: '列出所有已保存的 DeepSeek 对话会话',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const list = sessions.list()
      return {
        content: [{
          type: 'text',
          text: list.length === 0 ? '暂无会话' : 
            list.map(s => `[${s.project}] ${s.url}`).join('\n')
        }]
      }
    }
  })

  // 注册工具:执行 V4 返回的计划
  ctx.tools.register({
    name: 'run_ds_plan',
    description: '执行 DeepSeek 返回的执行计划',
    inputSchema: {
      type: 'object',
      properties: {
        planRef: { type: 'string', description: '计划引用路径(runs/xxx)' },
        dryRun: { type: 'boolean', description: '是否仅演练不执行', default: false }
      },
      required: ['planRef']
    },
    execute: async (args) => {
      return {
        content: [{
          type: 'text',
          text: `请执行: node src/index.js --${args.dryRun ? 'dry-run ' : ''}--run "${args.planRef}"`
        }]
      }
    }
  })

  // 清理
  ctx.effect(() => {
    return () => {}
  })
}

module.exports = { name, inject, apply }
