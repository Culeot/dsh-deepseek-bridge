#!/usr/bin/env node

const path = require('path');
const { askDeepSeek, checkAuthValid, listSessions, deleteSession, detectProjectName } = require('./ask');

/**
 * DeepSeek Bridge - DSH 龙猫 ↔ DeepSeek V4 Pro 桥接插件
 * 
 * 核心特性:
 * - 同一项目复用对话窗口(上下文连续)
 * - 新项目自动新建对话(上下文隔离)
 * - 专家模式 + 深度思考自动开启
 * - 登录态过期自动检测
 * 
 * 用法:
 *   node src/index.js [选项] "你的问题"
 *   echo "你的问题" | node src/index.js
 */

function parseArgs(argv) {
  const args = argv.slice(2);
  const result = {
    question: null,
    project: null,  // null = 自动检测
    expertMode: true,
    deepThink: true,
    headless: false,
    stream: false,
    keepOpen: false,
    forceNew: false,
    requireJson: true,
    dryRun: false,
    runPlan: null,
    listRuns: false,
    listSessions: false,
    deleteSession: null,
    checkAuth: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--question':
      case '-q':
        result.question = args[++i];
        break;
      case '--project':
      case '-p':
        result.project = args[++i];
        break;
      case '--no-expert':
        result.expertMode = false;
        break;
      case '--no-think':
        result.deepThink = false;
        break;
      case '--no-json':
        result.requireJson = false;
        break;
      case '--headless':
      case '-H':
        result.headless = true;
        break;
      case '--stream':
      case '-s':
        result.stream = true;
        break;
      case '--keep-open':
      case '-k':
        result.keepOpen = true;
        break;
      case '--new':
      case '-n':
        result.forceNew = true;
        break;
      case '--no-json':
        result.requireJson = false;
        break;
      case '--dry-run':
      case '-D':
        result.dryRun = true;
        break;
      case '--run':
      case '-r':
        result.runPlan = args[++i];
        break;
      case '--runs':
        result.listRuns = true;
        break;
      case '--list':
      case '-l':
        result.listSessions = true;
        break;
      case '--delete':
      case '-d':
        result.deleteSession = args[++i];
        break;
      case '--check':
        result.checkAuth = true;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
      default:
        if (!arg.startsWith('-') && !result.question) {
          result.question = arg;
        }
        break;
    }
  }

  return result;
}

function showHelp() {
  console.log(`
DeepSeek Bridge - DSH 龙猫 ↔ DeepSeek V4 Pro 桥接插件

用法:
  node src/index.js [选项] "你的问题"
  echo "你的问题" | node src/index.js

选项:
  --question, -q    问题内容
  --project, -p     项目名称(用于会话复用,默认自动检测)
  --no-expert       不使用专家模式(默认使用)
  --no-think        不开启深度思考(默认开启)
  --no-json         不要求 JSON 输出(默认要求)
  --headless, -H    隐藏浏览器窗口
  --stream, -s      流式输出(实时打印)
  --keep-open, -k   浏览器保持打开
  --new, -n        强制新建对话(不复用)
  --list, -l        列出所有已保存的会话
  --delete, -d      删除指定项目的会话
  --check           检查登录态是否有效
  --help, -h        显示帮助

示例:
  node src/index.js --project "番茄钟" "帮我设计一个架构"
  node src/index.js --project "番茄钟" "核心模块怎么划分?"
  node src/index.js --new --project "新项目" "重新开始"
  node src/index.js --dry-run --project "测试" "执行计划"
  node src/index.js --run runs/2026-08-17T1030_任务名
  node src/index.js --runs
  node src/index.js --list
  node src/index.js --delete "旧项目"

会话管理:
  同一项目 → 复用同一对话窗口(上下文连续,后续任务继续)
  新项目   → 自动新建对话(上下文隔离)
  --new    → 强制新建(不复用旧对话)
  会话信息保存在 data/sessions.json
`);
}

async function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data.trim()));
  });
}

async function main() {
  const config = parseArgs(process.argv);

  // 检查登录态
  if (config.checkAuth) {
    const valid = await checkAuthValid();
    console.log(valid ? '登录态有效' : '登录态无效或已过期');
    process.exit(valid ? 0 : 1);
  }

  // 列出会话
  if (config.listSessions) {
    const sessions = listSessions();
    if (sessions.length === 0) {
      console.log('暂无已保存的会话');
    } else {
      console.log('已保存的会话:');
      sessions.forEach(s => {
        console.log(`  [${s.project}]`);
        console.log(`    URL: ${s.url}`);
        console.log(`    更新: ${s.updatedAt}`);
      });
    }
    process.exit(0);
  }

  // 删除会话
  if (config.deleteSession) {
    deleteSession(config.deleteSession);
    console.log(`已删除项目 "${config.deleteSession}" 的会话`);
    process.exit(0);
  }

  // 列出运行记录
  if (config.listRuns) {
    const { listRuns } = require('./runner');
    const runs = listRuns();
    if (runs.length === 0) {
      console.log('暂无运行记录');
    } else {
      console.log('运行记录:');
      runs.forEach(r => {
        console.log(`  [${r.name}]`);
        if (r.status) {
          console.log(`    状态: ${r.status.status}`);
          console.log(`    步骤: ${r.status.steps?.length || 0}`);
        }
      });
    }
    process.exit(0);
  }

  // 执行计划
  if (config.runPlan) {
    await runPlan(config.runPlan, config);
    return;
  }

  // 获取问题
  if (!config.question) {
    if (process.stdin.isTTY) {
      showHelp();
      process.exit(1);
    }
    config.question = await readStdin();
  }

  if (!config.question) {
    console.error('错误:请提供问题内容');
    showHelp();
    process.exit(1);
  }

  // 检查登录态
  if (!(await checkAuthValid())) {
    console.error('警告:登录态无效或已过期,请运行 setup.sh 重新登录');
    process.exit(1);
  }

  // 自动检测项目名
  const projectName = config.project || detectProjectName();
  console.error(`[DS-Bridge] 项目: ${projectName}`);
  console.error(`[DS-Bridge] 问题: ${config.question.substring(0, 80)}...`);
  console.error(`[DS-Bridge] 模式:${config.expertMode ? '专家' : '快速'} | 深度思考:${config.deepThink ? '开' : '关'}`);

  try {
    const result = await askDeepSeek(config.question, {
      project: projectName,
      headless: config.headless,
      expertMode: config.expertMode,
      deepThink: config.deepThink,
      keepOpen: config.keepOpen,
      forceNew: config.forceNew,
      requireJson: config.requireJson !== false,
      onChunk: config.stream ? (text) => process.stdout.write(text) : null,
      onThinking: config.stream ? (text) => process.stderr.write(`[思考] ${text}`) : null
    });

    if (result.error) {
      console.error(`\n[DS-Bridge] 错误: ${result.error}`);
      if (result.error.includes('登录态')) {
        console.error('提示: 请运行 setup.sh 重新登录 DeepSeek');
      }
      process.exit(1);
    }

    if (!config.stream) {
      if (result.thinking) {
        console.log('=== 思考过程 ===');
        console.log(result.thinking);
        console.log('\n=== 回答 ===');
      }
      console.log(result.answer);
      
      // JSON 解析和验证
      if (config.requireJson !== false && result.answer) {
        const { parseResponse, validateResponse } = require('./prompt');
        const { savePlan } = require('./runner');
        const parsed = parseResponse(result.answer);
        const validation = validateResponse(parsed);
        if (validation.valid) {
          console.log('\n=== JSON 解析成功 ===');
          console.log(`推荐方案: ${parsed.recommendation}`);
          console.log(`方案数量: ${parsed.alternatives?.length || 0}`);
          console.log(`执行步骤: ${parsed.execution_plan?.length || 0}`);
          
          // 保存执行计划
          try {
            const saved = savePlan(projectName, parsed);
            console.log(`\n计划已保存: ${saved.dir}`);
            console.log(`执行: node src/index.js --run "${saved.dir}"`);
            console.log(`演练: node src/index.js --dry-run --run "${saved.dir}"`);
          } catch (e) {
            console.error(`保存计划失败: ${e.message}`);
          }
        } else {
          console.error('\n=== JSON 解析警告 ===');
          console.error(`原因: ${validation.error || '结构不完整'}`);
        }
      }
    }

    console.error(`\n[DS-Bridge] 完成 | 耗时: ${(result.duration / 1000).toFixed(1)}s | 回答长度: ${result.answer.length} 字符`);
    if (result.sessionUrl) {
      console.error(`[DS-Bridge] 对话: ${result.sessionUrl}`);
    }

  } catch (err) {
    console.error(`[DS-Bridge] 致命错误: ${err.message}`);
    if (err.message.includes('登录态')) {
      console.error('提示: 请运行 setup.sh 重新登录 DeepSeek');
    }
    process.exit(1);
  }
}

async function runPlan(planRef, config) {
  const { validatePlan, loadStatus, saveStatus, executeStep, verifyStep } = require('./runner');
  
  // 加载计划
  let statusFile;
  if (planRef.startsWith('runs/') || planRef.startsWith('runs\\')) {
    statusFile = path.join(__dirname, '..', planRef, 'status.json');
  } else {
    statusFile = path.join(__dirname, '..', 'runs', planRef, 'status.json');
  }
  
  const status = loadStatus(statusFile);
  if (!status) {
    console.error(`找不到运行记录: ${planRef}`);
    process.exit(1);
  }

  console.log(`任务: ${status.task}`);
  console.log(`状态: ${status.status}`);
  console.log(`步骤数: ${status.steps.length}`);
  console.log('');

  // 执行每个步骤
  for (const step of status.steps) {
    if (step.status === 'success') {
      console.log(`[步骤 ${step.step}] ✓ 已跳过(已完成)`);
      continue;
    }

    console.log(`[步骤 ${step.step}] ${step.action}`);
    console.log(`  命令: ${step.command}`);
    
    // 执行
    const result = executeStep(step, { 
      dryRun: config.dryRun,
      timeout: 120000 
    });
    
    step.result = result;
    
    if (result.success) {
      // 验证
      const verifyResult = verifyStep(step, result);
      if (verifyResult.success) {
        // 只在非 dry-run 状态下更新状态
        if (!config.dryRun) {
          step.status = 'success';
          saveStatus(statusFile, status);
        }
        console.log(`  ✓ 成功${config.dryRun ? ' (演练)' : ''}: ${verifyResult.message}`);
      } else {
        if (!config.dryRun) {
          step.status = 'failed';
          step.error = verifyResult.message;
          saveStatus(statusFile, status);
        }
        console.log(`  ✗ 验证失败: ${verifyResult.message}`);
        if (!config.dryRun) break;
      }
    } else {
      if (!config.dryRun) {
        step.status = 'failed';
        step.error = result.error;
        saveStatus(statusFile, status);
      }
      console.log(`  ✗ 失败: ${result.error}`);
      if (!config.dryRun) break;
    }
  }

  // 输出总结(非 dry-run 时更新最终状态)
  const successCount = status.steps.filter(s => s.status === 'success').length;
  const failCount = status.steps.filter(s => s.status === 'failed').length;
  
  console.log('');
  console.log(`完成: ${successCount}/${status.steps.length} 成功, ${failCount} 失败${config.dryRun ? ' (演练)' : ''}`);
  
  if (!config.dryRun) {
    if (failCount === 0) {
      status.status = 'completed';
    } else {
      status.status = 'failed';
    }
    saveStatus(statusFile, status);
  }
}

main();
