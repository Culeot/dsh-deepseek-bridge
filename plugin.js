'use strict'

var SessionManager = require('./src/session').SessionManager
var sessions = new SessionManager()

var name = 'deepseek-bridge'
var inject = ['tools']

function apply(ctx) {
  ctx.tools.register({
    name: 'ask_ds',
    description: '向 DeepSeek 网页端 V4 Pro 提问,获取架构方案。用于复杂任务需要深度推理时。',
    parameters: {
      type: 'object',
      properties: {
        question: { type: 'string', description: '要提问的内容' },
        project: { type: 'string', description: '项目名称' }
      },
      required: ['question']
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          content: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                text: { type: 'string' }
              }
            }
          }
        }
      },
      render: function(output) { return output }
    },
    execute: function(args) {
      var project = args.project || 'default'
      var question = args.question.replace(/"/g, '\\"')
      return {
        content: [{
          type: 'text',
          text: 'node src/index.js --project "' + project + '" "' + question + '"'
        }]
      }
    }
  })

  ctx.tools.register({
    name: 'list_ds_sessions',
    description: '列出所有已保存的 DeepSeek 对话会话',
    parameters: {
      type: 'object',
      properties: {}
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          content: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                text: { type: 'string' }
              }
            }
          }
        }
      },
      render: function(output) { return output }
    },
    execute: function() {
      var list = sessions.list()
      return {
        content: [{
      type: 'text',
      text: list.length === 0 ? '暂无会话' : list.map(function(s) { return '[' + s.project + '] ' + s.url }).join('\n')
        }]
      }
    }
  })

  ctx.tools.register({
    name: 'run_ds_plan',
    description: '执行 DeepSeek 返回的执行计划',
    parameters: {
      type: 'object',
      properties: {
        planRef: { type: 'string', description: '计划引用路径' },
        dryRun: { type: 'boolean', description: '是否仅演练' }
      },
      required: ['planRef']
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          content: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                text: { type: 'string' }
              }
            }
          }
        }
      },
      render: function(output) { return output }
    },
    execute: function(args) {
      return {
        content: [{
          type: 'text',
          text: 'node src/index.js --' + (args.dryRun ? 'dry-run ' : '') + '--run "' + args.planRef + '"'
        }]
      }
    }
  })

  ctx.effect(function() {
    return function() {}
  })
}

module.exports = { name: name, inject: inject, apply: apply }
