const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

/**
 * 会话管理器 - 管理项目与 DeepSeek 对话 URL 的映射
 * 
 * 核心逻辑:
 * - 同一个项目 → 复用同一个对话 URL → 上下文连续
 * - 新项目 → 新建对话 → 上下文隔离
 */
class SessionManager {
  constructor() {
    this.sessions = this._load();
  }

  /**
   * 获取项目的对话 URL
   * @param {string} projectName - 项目名称(如 "番茄钟应用")
   * @returns {string|null} 对话 URL,如果不存在返回 null
   */
  get(projectName) {
    const entry = this.sessions[projectName];
    if (!entry) return null;
    return entry.url;
  }

  /**
   * 保存项目的对话 URL
   * @param {string} projectName - 项目名称
   * @param {string} url - 对话 URL
   */
  set(projectName, url) {
    this.sessions[projectName] = {
      url,
      updatedAt: new Date().toISOString()
    };
    this._save();
  }

  /**
   * 删除项目的会话记录
   * @param {string} projectName - 项目名称
   */
  delete(projectName) {
    delete this.sessions[projectName];
    this._save();
  }

  /**
   * 列出所有已保存的会话
   */
  list() {
    return Object.entries(this.sessions).map(([name, data]) => ({
      project: name,
      url: data.url,
      updatedAt: data.updatedAt
    }));
  }

  /**
   * 从文件加载会话数据
   */
  _load() {
    if (!fs.existsSync(SESSIONS_FILE)) return {};
    try {
      return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
    } catch (e) {
      return {};
    }
  }

  /**
   * 保存会话数据到文件
   */
  _save() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(this.sessions, null, 2));
  }
}

// 自动检测当前项目名(从 git 仓库名或目录名)
function detectProjectName() {
  // 尝试从 git 获取
  try {
    const { execSync } = require('child_process');
    const gitRoot = execSync('git rev-parse --show-toplevel 2>/dev/null || echo ""', { encoding: 'utf8' }).trim();
    if (gitRoot) {
      return path.basename(gitRoot);
    }
  } catch (e) {}

  // 回退到当前目录名
  return path.basename(process.cwd());
}

module.exports = { SessionManager, detectProjectName, SESSIONS_FILE };
