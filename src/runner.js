/**
 * Plan Runner - 执行计划解析与逐步执行
 * 
 * 核心原则:
 * - 先生成计划,人工确认后再执行(第一版不自动执行)
 * - 每步执行后验证,失败则停止
 * - 支持回滚
 * - 状态持久化,中断后可恢复
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RUNS_DIR = path.join(__dirname, '..', 'runs');

/**
 * 验证执行计划
 */
function validatePlan(plan) {
  if (!plan || typeof plan !== 'object') {
    return { valid: false, error: '计划格式错误' };
  }

  if (!Array.isArray(plan.execution_plan) || plan.execution_plan.length === 0) {
    return { valid: false, error: '执行计划不能为空' };
  }

  for (const step of plan.execution_plan) {
    if (!step.action || !step.command) {
      return { valid: false, error: `步骤 ${step.step} 缺少 action 或 command` };
    }
  }

  return { valid: true };
}

/**
 * 保存执行计划到文件
 */
function savePlan(taskName, plan) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dirName = `${timestamp}_${taskName.replace(/[^a-zA-Z0-9_\u4e00-\u9fff]/g, '_')}`;
  const dir = path.join(RUNS_DIR, dirName);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 保存完整计划
  fs.writeFileSync(path.join(dir, 'plan.json'), JSON.stringify(plan, null, 2));

  // 保存状态文件
  const status = {
    task: taskName,
    created_at: new Date().toISOString(),
    status: 'pending_review',
    current_step: 0,
    steps: plan.execution_plan.map(s => ({
      step: s.step,
      action: s.action,
      command: s.command,
      status: 'pending',
      approved: false,
      result: null,
      error: null
    }))
  };
  fs.writeFileSync(path.join(dir, 'status.json'), JSON.stringify(status, null, 2));

  return { dir, planFile: path.join(dir, 'plan.json'), statusFile: path.join(dir, 'status.json') };
}

/**
 * 加载执行状态
 */
function loadStatus(statusFile) {
  if (!fs.existsSync(statusFile)) return null;
  return JSON.parse(fs.readFileSync(statusFile, 'utf8'));
}

/**
 * 保存执行状态
 */
function saveStatus(statusFile, status) {
  fs.writeFileSync(statusFile, JSON.stringify(status, null, 2));
}

/**
 * 跨平台命令翻译(Unix → Windows)
 */
function translateCommand(cmd) {
  if (process.platform !== 'win32') return cmd;
  
  let result = cmd;
  
  // 路径分隔符转换: / → \ (但排除 http:// 等 URL)
  // 同时转换 Python venv 路径: bin/ → Scripts/
  result = result.replace(/(?<!:)\/(\\)?/g, (match, backslash) => {
    if (backslash) return match; // 已经是 \\ 的不变
    return '\\';
  });
  
  // Python venv 路径转换: .venv/bin/ → .venv\Scripts\
  result = result.replace(/(\\.venv|venv|env)\\bin\\/g, '$1\\Scripts\\');
  
  // 命令映射
  const translations = [
    // mkdir -p → mkdir (Windows 自动创建父目录)
    { from: /^mkdir\s+-p\s+/, to: 'mkdir ' },
    // ls → dir
    { from: /^ls(\s|$)/, to: 'dir ' },
    // cat → type
    { from: /^cat\s+/, to: 'type ' },
    // grep → findstr
    { from: /^grep\s+/, to: 'findstr ' },
    // python3 → python
    { from: /^python3(\s|$)/, to: 'python ' },
    // touch → echo. > (创建空文件)
    { from: /^touch\s+/, to: 'echo. > ' },
    // cp → copy
    { from: /^cp\s+/, to: 'copy ' },
    // mv → move
    { from: /^mv\s+/, to: 'move ' },
    // rm → del (但危险命令已被拦截)
    { from: /^rm\s+/, to: 'del ' },
  ];
  
  for (const t of translations) {
    result = result.replace(t.from, t.to);
  }
  
  return result;
}

/**
 * 执行单个步骤(安全模式)
 */
function executeStep(step, options = {}) {
  const { 
    dryRun = false, 
    timeout = 120000,
    workDir = process.cwd(),
    allowedCommands = ['python', 'python3', 'pip', 'node', 'npm', 'mkdir', 'ls', 'cat', 'echo', 'curl', 'git']
  } = options;

  // 安全检查:命令白名单(检查命令是否包含允许的命令)
  const cmd = step.command.trim();
  const isAllowed = allowedCommands.some(allowed => {
    // 检查命令是否以允许的命令开头,或者路径中包含允许的命令
    return cmd === allowed || 
           cmd.startsWith(allowed + ' ') || 
           cmd.startsWith(allowed + '/') ||
           cmd.includes('/' + allowed + ' ') ||
           cmd.includes('/' + allowed + ';') ||
           cmd.endsWith('/' + allowed);
  });
  
  if (!isAllowed) {
    return { 
      success: false, 
      error: `命令不在白名单中: ${cmd.split(/\s+/)[0]}. 允许的命令: ${allowedCommands.join(', ')}` 
    };
  }

  // 危险命令检查
  const dangerous = ['rm -rf', 'shutdown', 'format', 'del /f', 'mkfs'];
  if (dangerous.some(d => cmd.includes(d))) {
    return { success: false, error: `危险命令被禁止: ${cmd}` };
  }

  if (dryRun) {
    return { success: true, dryRun: true, command: cmd };
  }

  // Windows 命令翻译(Unix → Windows)
  const winCmd = translateCommand(cmd);

  try {
    const result = execSync(winCmd, {
      cwd: workDir,
      timeout,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh'
    });
    return { success: true, output: result };
  } catch (e) {
    return { 
      success: false, 
      error: e.message,
      stdout: e.stdout?.toString() || '',
      stderr: e.stderr?.toString() || ''
    };
  }
}

/**
 * 验证步骤执行结果
 */
function verifyStep(step, result) {
  if (!step.verify) return { success: true, message: '无验证条件' };

  // 简单验证:检查输出中是否包含预期字符串
  if (step.verify.includes('检查输出包含')) {
    const expected = step.verify.replace('检查输出包含', '').trim();
    if (result.output && result.output.includes(expected)) {
      return { success: true, message: `输出包含预期内容: ${expected}` };
    }
    return { success: false, message: `输出不包含预期内容: ${expected}` };
  }

  // 默认:命令成功执行即视为验证通过
  return { success: result.success, message: result.success ? '命令执行成功' : result.error };
}

/**
 * 列出所有运行记录
 */
function listRuns() {
  if (!fs.existsSync(RUNS_DIR)) return [];
  return fs.readdirSync(RUNS_DIR)
    .filter(name => fs.statSync(path.join(RUNS_DIR, name)).isDirectory())
    .map(name => {
      const statusFile = path.join(RUNS_DIR, name, 'status.json');
      const status = fs.existsSync(statusFile) ? JSON.parse(fs.readFileSync(statusFile, 'utf8')) : null;
      return { name, status };
    });
}

module.exports = {
  validatePlan,
  savePlan,
  loadStatus,
  saveStatus,
  executeStep,
  verifyStep,
  listRuns,
  RUNS_DIR
};
