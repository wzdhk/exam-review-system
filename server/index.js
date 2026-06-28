const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

if (isProduction) {
  app.use(express.static(path.join(__dirname, '../dist')));
}

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function safeUnlink(filePath, attempts = 5) {
  if (!filePath) return;
  let tries = 0;
  const tryDelete = () => {
    tries++;
    fs.unlink(filePath, (err) => {
      if (!err) return;
      if (err.code === 'ENOENT') return;
      if ((err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EACCES') && tries < attempts) {
        setTimeout(tryDelete, 300 * tries);
      } else if (tries < attempts) {
        setTimeout(tryDelete, 300 * tries);
      } else {
        console.warn('删除上传文件失败：', filePath, err.code || err.message);
      }
    });
  };
  tryDelete();
}

function sweepUploadsDir(maxAgeMs = 5 * 60 * 1000) {
  fs.readdir(uploadsDir, (err, files) => {
    if (err) return;
    const now = Date.now();
    files.forEach(name => {
      const fp = path.join(uploadsDir, name);
      fs.stat(fp, (e, st) => {
        if (e || !st || !st.isFile()) return;
        if (now - st.mtimeMs >= maxAgeMs) safeUnlink(fp);
      });
    });
  });
}

sweepUploadsDir(0);
setInterval(() => sweepUploadsDir(), 10 * 60 * 1000).unref();

const adapter = new FileSync('db.json');
const db = low(adapter);

db.defaults({
  users: [],
  sessions: [],
  questionBanks: [],
  questions: [],
  mistakes: [],
  progress: []
}).write();

function hashPassword(password, salt) {
  const useSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, useSalt, 100000, 64, 'sha256').toString('hex');
  return { hash, salt: useSalt };
}

function verifyPassword(password, salt, expected) {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function nextId(collection) {
  const items = db.get(collection).value();
  return items.length > 0 ? Math.max(...items.map(i => i.id || 0)) + 1 : 1;
}

(function initAdmin() {
  const users = db.get('users').value();
  if (users.length === 0) {
    const { hash, salt } = hashPassword('admin123');
    db.get('users').push({
      id: 1,
      username: 'admin',
      password_hash: hash,
      password_salt: salt,
      role: 'admin',
      created_at: new Date().toISOString()
    }).write();
    console.log('已创建默认管理员账户：admin / admin123');

    const orphanBanks = db.get('questionBanks').filter(b => !b.user_id).value();
    if (orphanBanks.length > 0) {
      orphanBanks.forEach(b => {
        db.get('questionBanks').find({ id: b.id }).assign({ user_id: 1 }).write();
      });
      console.log(`迁移了 ${orphanBanks.length} 个历史题库到 admin 账户`);
    }
    const orphanMistakes = db.get('mistakes').filter(m => !m.user_id).value();
    if (orphanMistakes.length > 0) {
      orphanMistakes.forEach(m => {
        db.get('mistakes').find({ id: m.id }).assign({ user_id: 1 }).write();
      });
    }
    const orphanProgress = db.get('progress').filter(p => !p.user_id).value();
    if (orphanProgress.length > 0) {
      orphanProgress.forEach(p => {
        db.get('progress').find({ id: p.id }).assign({ user_id: 1 }).write();
      });
    }
  }
})();

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录' });
  }
  const token = header.substring(7);
  const session = db.get('sessions').find({ token }).value();
  if (!session) return res.status(401).json({ error: '登录已失效' });
  if (new Date(session.expires_at) < new Date()) {
    db.get('sessions').remove({ token }).write();
    return res.status(401).json({ error: '登录已过期' });
  }
  const user = db.get('users').find({ id: session.user_id }).value();
  if (!user) return res.status(401).json({ error: '用户不存在' });
  req.user = { id: user.id, username: user.username, role: user.role };
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  next();
}

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    cb(null, Date.now() + '_' + Math.random().toString(36).slice(2, 8) + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

function normalizeJudgment(text) {
  if (!text) return '';
  const t = text.trim().toUpperCase();
  if (['对', '正确', '√', 'T', 'TRUE', '是', 'YES', 'Y'].includes(t)) return '对';
  if (['错', '错误', '×', 'X', 'F', 'FALSE', '否', 'NO', 'N'].includes(t)) return '错';
  return text.trim();
}

function isJudgmentAnswer(text) {
  const n = normalizeJudgment(text);
  return n === '对' || n === '错';
}

const TYPE_PREFIX_RE = /^(判断题|选择题|单选题|多选题|填空题|简答题|论述题|问答题|编程题|分析题|计算题|名词解释|应用题)/;
const ANSWER_LINE_RE = /^\s*[【\[]?\s*(?:参考|正确|标准)?\s*(?:答案|答|Answer|Ans|解答|参考答案|正确答案)\s*[】\]]?\s*[:：.．]\s*(.*)$/i;
const OPTION_LINE_RE = /^\s*([A-Ja-j])\s*[.、)）．：:\s]\s*(.+)$/;
const CIRCLED_OPTION_RE = /^\s*([①②③④⑤⑥⑦⑧⑨⑩])\s*[.、)）．：:]?\s*(.+)$/;
const CIRCLED_MAP = { '①': 'A', '②': 'B', '③': 'C', '④': 'D', '⑤': 'E', '⑥': 'F', '⑦': 'G', '⑧': 'H', '⑨': 'I', '⑩': 'J' };

const TYPE_MAP = {
  '判断题': 'judgment',
  '选择题': 'multiple_choice',
  '单选题': 'multiple_choice',
  '多选题': 'multiple_select',
  '填空题': 'fill_blank',
  '简答题': 'essay',
  '论述题': 'essay',
  '问答题': 'essay',
  '编程题': 'coding',
  '分析题': 'essay',
  '计算题': 'essay',
  '名词解释': 'essay',
  '应用题': 'essay'
};

const SECTION_HEADING_RES = [
  /^第\s*[\d一二三四五六七八九十百千]+\s*[章节部分篇讲单元课]/,
  /^Chapter\s*\d+/i,
  /^Section\s*\d+/i,
  /^Part\s*[\dIVX]+/i,
  /^\d+(\.\d+){1,}\s+\S/,
  /^[一二三四五六七八九十]+\s*[、.．]\s*(判断题|选择题|单选题|多选题|填空题|简答题|论述题|问答题|编程题|分析题|计算题|名词解释|应用题)/,
  /^(判断题|选择题|单选题|多选题|填空题|简答题|论述题|问答题|编程题|分析题|计算题|名词解释|应用题)\s*[（(][^）)]*[）)]\s*$/,
  /^(判断题|选择题|单选题|多选题|填空题|简答题|论述题|问答题|编程题|分析题|计算题|名词解释|应用题)\s*$/
];

function detectSectionType(text) {
  const t = text.trim();
  const m = t.match(/^(?:[一二三四五六七八九十]+\s*[、.．]\s*)?(判断题|选择题|单选题|多选题|填空题|简答题|论述题|问答题|编程题|分析题|计算题|名词解释|应用题)/);
  return m ? m[1] : null;
}

function isSectionHeading(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length > 2) return false;
  const text = lines.join(' ').trim();
  if (!text) return true;
  if (ANSWER_LINE_RE.test(text)) return false;
  if (OPTION_LINE_RE.test(text) || CIRCLED_OPTION_RE.test(text)) return false;
  if (text.length > 50) return false;
  return SECTION_HEADING_RES.some(re => re.test(text));
}

function isQuestionStart(line) {
  const t = line.trim();
  if (!t) return false;
  if (SECTION_HEADING_RES.some(re => re.test(t))) return false;
  if (/^\d+\s*[.．、)）]/.test(t)) return true;
  if (/^[（(]\s*\d+\s*[)）]/.test(t)) return true;
  if (/^\[\s*\d+\s*\]/.test(t)) return true;
  if (/^第\s*[\d一二三四五六七八九十百千]+\s*[题道]/.test(t)) return true;
  if (/^[一二三四五六七八九十]+\s*[、.．]/.test(t)) return true;
  if (TYPE_PREFIX_RE.test(t)) return true;
  return false;
}

function stripLeadingNumber(line) {
  return line
    .replace(/^\s*\d+\s*[.．、)）]\s*/, '')
    .replace(/^\s*[（(]\s*\d+\s*[)）]\s*/, '')
    .replace(/^\s*\[\s*\d+\s*\]\s*/, '')
    .replace(/^\s*第\s*[\d一二三四五六七八九十百千]+\s*[题道]\s*[：:、.．]?\s*/, '')
    .replace(/^\s*[一二三四五六七八九十]+\s*[、.．]\s*/, '');
}

function mapOptionLabel(label) {
  if (CIRCLED_MAP[label]) return CIRCLED_MAP[label];
  return label.toUpperCase();
}

function isSectionHeadingLine(line) {
  const t = line.trim();
  if (!t) return false;
  if (t.length > 60) return false;
  if (ANSWER_LINE_RE.test(t)) return false;
  if (OPTION_LINE_RE.test(t) || CIRCLED_OPTION_RE.test(t)) return false;
  return SECTION_HEADING_RES.some(re => re.test(t));
}

function splitIntoBlocks(text) {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let current = null;

  const flush = () => {
    if (current && current.lines.some(l => l.trim())) blocks.push(current);
    current = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isSectionHeadingLine(line)) {
      flush();
      continue;
    }
    if (isQuestionStart(line)) {
      flush();
      current = { lineStart: i + 1, lines: [line] };
    } else if (current) {
      current.lines.push(line);
    } else if (line.trim()) {
      current = { lineStart: i + 1, lines: [line] };
    }
  }
  flush();

  if (blocks.length <= 1) {
    const fallback = splitByBlankLines(text);
    if (fallback.length > blocks.length) return fallback;
  }

  return blocks.map(b => ({ lineStart: b.lineStart, text: b.lines.join('\n').trim() }));
}

function splitByBlankLines(text) {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let buf = [];
  let lineStart = 0;
  let hasAnswer = false;

  const flush = () => {
    const joined = buf.join('\n').trim();
    if (joined) blocks.push({ lineStart, text: joined });
    buf = [];
    hasAnswer = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      if (hasAnswer) flush();
      else if (buf.length) buf.push(line);
      continue;
    }
    if (!buf.length) lineStart = i + 1;
    buf.push(line);
    if (ANSWER_LINE_RE.test(line)) hasAnswer = true;
  }
  flush();
  return blocks;
}

function parseBlock(rawText) {
  const lines = rawText.split('\n').map(l => l.replace(/\s+$/, ''));
  let typeHint = null;

  let firstIdx = lines.findIndex(l => l.trim());
  if (firstIdx === -1) return { ok: false, reason: '题目内容为空' };

  let firstLine = stripLeadingNumber(lines[firstIdx]);
  const tm = firstLine.match(new RegExp('^(' + Object.keys(TYPE_MAP).join('|') + ')\\s*[:：]?\\s*'));
  if (tm) {
    typeHint = tm[1];
    firstLine = firstLine.slice(tm[0].length).trim();
  }

  const questionLines = firstLine ? [firstLine] : [];
  const options = [];
  let answer = '';
  let mode = 'question';
  const answerExtraLines = [];

  for (let i = firstIdx + 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) {
      if (mode === 'answer') answerExtraLines.push('');
      continue;
    }
    const line = raw.trim();

    const ansMatch = line.match(ANSWER_LINE_RE);
    if (ansMatch) {
      answer = ansMatch[1].trim();
      mode = 'answer';
      continue;
    }

    if (mode === 'answer') {
      answerExtraLines.push(raw);
      continue;
    }

    const optMatch = line.match(OPTION_LINE_RE) || line.match(CIRCLED_OPTION_RE);
    if (optMatch) {
      options.push({ label: mapOptionLabel(optMatch[1]), text: optMatch[2].trim() });
      mode = 'options';
      continue;
    }

    if (mode === 'question') {
      questionLines.push(line);
    } else if (mode === 'options' && options.length) {
      options[options.length - 1].text += ' ' + line;
    }
  }

  if (answerExtraLines.length) {
    const extra = answerExtraLines.join('\n').replace(/\n+$/, '');
    if (extra.trim()) answer = (answer ? answer + '\n' : '') + extra;
  }
  answer = answer.trim();

  let questionText = questionLines.join('\n').trim();
  let trailingJudgeMark = null;
  const tail = questionText.match(/[√×]\s*$/);
  if (tail) {
    trailingJudgeMark = tail[0].trim();
    questionText = questionText.replace(/[√×]\s*$/, '').trim();
  }

  if (!questionText) return { ok: false, reason: '题干为空' };
  if (!answer) return { ok: false, reason: '未找到答案（缺少"答案："标记）' };

  let type;
  if (typeHint) {
    type = TYPE_MAP[typeHint];
  } else if (options.length >= 2) {
    type = 'multiple_choice';
  } else if (trailingJudgeMark || isJudgmentAnswer(answer)) {
    type = 'judgment';
  } else if (/[_＿]{2,}/.test(questionText) || /[（(]\s*[)）]/.test(questionText)) {
    type = 'fill_blank';
  } else {
    type = 'essay';
  }

  if (type === 'multiple_choice' || type === 'multiple_select') {
    if (options.length < 2) return { ok: false, reason: '选择题选项不足（识别到 ' + options.length + ' 项）' };
    const cleaned = answer.replace(/[\s,，、;；]/g, '').toUpperCase();
    if (!/^[A-J]+$/.test(cleaned)) {
      return { ok: false, reason: '选择题答案格式异常：' + answer };
    }
    if (type === 'multiple_choice' && cleaned.length > 1) {
      type = 'multiple_select';
    }
    if (type === 'multiple_select' && cleaned.length === 1 && !typeHint) {
      type = 'multiple_choice';
    }
    answer = cleaned.split('').join('');
  }

  if (type === 'judgment') {
    const normalized = normalizeJudgment(answer);
    if (normalized !== '对' && normalized !== '错') {
      return { ok: false, reason: '判断题答案无法识别（需为 对/错/√/×/T/F）' };
    }
    answer = normalized;
  }

  return {
    ok: true,
    question: {
      type,
      question: questionText,
      options: options.length ? options : null,
      answer
    }
  };
}

function parseQuestions(text) {
  const normalized = text.replace(/　/g, ' ');
  const blocks = splitIntoBlocks(normalized);
  const questions = [];
  const warnings = [];

  blocks.forEach((block, idx) => {
    const result = parseBlock(block.text);
    if (result.ok) {
      questions.push(result.question);
    } else {
      warnings.push({
        index: idx + 1,
        lineStart: block.lineStart,
        reason: result.reason,
        snippet: block.text.length > 240 ? block.text.slice(0, 240) + '…' : block.text
      });
    }
  });

  return { questions, warnings, totalBlocks: blocks.length };
}

function checkAnswer(question, userAnswer) {
  const ua = (userAnswer || '').trim();
  const ca = (question.answer || '').trim();
  if (!ua) return false;
  if (question.type === 'multiple_choice') {
    return ua.toUpperCase() === ca.toUpperCase();
  }
  if (question.type === 'multiple_select') {
    const norm = (s) => s.replace(/[\s,，、;；]/g, '').toUpperCase().split('').sort().join('');
    return norm(ua) === norm(ca);
  }
  if (question.type === 'judgment') {
    return normalizeJudgment(ua) === normalizeJudgment(ca);
  }
  if (question.type === 'fill_blank') {
    const accepts = ca.split(/[\/|｜／]/).map(s => s.trim()).filter(Boolean);
    const norm = (s) => s.replace(/\s+/g, '').toLowerCase();
    return accepts.some(a => norm(a) === norm(ua));
  }
  return false;
}

app.post('/api/auth/register', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
    if (username.length < 2 || username.length > 20) return res.status(400).json({ error: '用户名长度需要2-20位' });
    if (password.length < 6) return res.status(400).json({ error: '密码至少需要6位' });
    if (!/^[a-zA-Z0-9_一-龥]+$/.test(username)) return res.status(400).json({ error: '用户名只能包含字母、数字、下划线和中文' });

    const exists = db.get('users').find({ username }).value();
    if (exists) return res.status(400).json({ error: '用户名已被占用' });

    const { hash, salt } = hashPassword(password);
    const id = nextId('users');
    const user = {
      id,
      username,
      password_hash: hash,
      password_salt: salt,
      role: 'user',
      created_at: new Date().toISOString()
    };
    db.get('users').push(user).write();

    const token = generateToken();
    const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    db.get('sessions').push({ token, user_id: id, expires_at, created_at: new Date().toISOString() }).write();

    res.json({ token, user: { id, username, role: 'user' } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
    const user = db.get('users').find({ username }).value();
    if (!user) return res.status(400).json({ error: '用户名或密码错误' });
    if (!verifyPassword(password, user.password_salt, user.password_hash)) {
      return res.status(400).json({ error: '用户名或密码错误' });
    }
    const token = generateToken();
    const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    db.get('sessions').push({ token, user_id: user.id, expires_at, created_at: new Date().toISOString() }).write();
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/logout', authenticate, (req, res) => {
  const header = req.headers.authorization;
  const token = header.substring(7);
  db.get('sessions').remove({ token }).write();
  res.json({ success: true });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json(req.user);
});

app.post('/api/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: '没有上传文件' });

    let text = '';
    const ext = path.extname(file.originalname).toLowerCase();
    try {
      if (ext === '.pdf') {
        const buf = fs.readFileSync(file.path);
        const data = await pdfParse(buf);
        text = data.text;
      } else if (ext === '.docx') {
        const buf = fs.readFileSync(file.path);
        const result = await mammoth.extractRawText({ buffer: buf });
        text = result.value;
      } else if (ext === '.txt') {
        text = fs.readFileSync(file.path, 'utf-8');
      } else {
        safeUnlink(file.path);
        return res.status(400).json({ error: '不支持的文件格式，请使用 PDF、DOCX 或 TXT' });
      }
    } finally {
      safeUnlink(file.path);
    }

    const { questions, warnings, totalBlocks } = parseQuestions(text);
    if (questions.length === 0) {
      return res.status(400).json({
        error: '没有解析出有效题目，请检查题库格式',
        warnings,
        totalBlocks
      });
    }

    const bankId = nextId('questionBanks');
    let qid = nextId('questions');
    const now = new Date().toISOString();
    const bankName = Buffer.from(file.originalname, 'latin1').toString('utf8');

    const questionsWithIds = questions.map(q => ({
      ...q,
      id: qid++,
      bank_id: bankId,
      user_id: req.user.id,
      created_at: now
    }));

    db.get('questionBanks').push({
      id: bankId,
      user_id: req.user.id,
      name: bankName,
      description: `导入于 ${new Date().toLocaleString('zh-CN')}`,
      question_count: questions.length,
      created_at: now
    }).write();
    db.get('questions').push(...questionsWithIds).write();

    const msg = warnings.length
      ? `导入题库 "${bankName}"：成功 ${questions.length} 题，${warnings.length} 题未识别`
      : `成功导入题库 "${bankName}"，共 ${questions.length} 道题目`;

    res.json({
      success: true,
      message: msg,
      count: questions.length,
      totalBlocks,
      warnings,
      bankId
    });
  } catch (e) {
    console.error('Upload error:', e);
    res.status(500).json({ error: '文件处理失败：' + e.message });
  }
});

app.get('/api/question-banks', authenticate, (req, res) => {
  try {
    let banks = db.get('questionBanks').value();
    if (req.user.role !== 'admin') {
      banks = banks.filter(b => b.user_id === req.user.id);
    }
    const users = db.get('users').value();
    const enriched = banks.map(b => {
      const owner = users.find(u => u.id === b.user_id);
      return { ...b, owner_username: owner ? owner.username : '未知' };
    });
    enriched.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(enriched);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/question-banks/:id', authenticate, (req, res) => {
  try {
    const bankId = parseInt(req.params.id);
    const bank = db.get('questionBanks').find({ id: bankId }).value();
    if (!bank) return res.status(404).json({ error: '题库不存在' });
    if (req.user.role !== 'admin' && bank.user_id !== req.user.id) {
      return res.status(403).json({ error: '没有权限删除该题库' });
    }
    const qids = db.get('questions').filter({ bank_id: bankId }).value().map(q => q.id);
    db.get('questionBanks').remove({ id: bankId }).write();
    db.get('questions').remove({ bank_id: bankId }).write();
    db.get('mistakes').remove(m => qids.includes(m.question_id)).write();
    db.get('progress').remove(p => qids.includes(p.question_id)).write();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/questions', authenticate, (req, res) => {
  try {
    const bankId = req.query.bankId ? parseInt(req.query.bankId) : null;
    const type = req.query.type || null;
    if (!bankId) return res.status(400).json({ error: '需要提供 bankId' });
    const bank = db.get('questionBanks').find({ id: bankId }).value();
    if (!bank) return res.status(404).json({ error: '题库不存在' });
    if (req.user.role !== 'admin' && bank.user_id !== req.user.id) {
      return res.status(403).json({ error: '没有权限访问该题库' });
    }
    let qs = db.get('questions').filter({ bank_id: bankId }).value();
    if (type && type !== 'all') qs = qs.filter(q => q.type === type);
    res.json(qs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/questions/types', authenticate, (req, res) => {
  try {
    const bankId = req.query.bankId ? parseInt(req.query.bankId) : null;
    if (!bankId) return res.status(400).json({ error: '需要提供 bankId' });
    const bank = db.get('questionBanks').find({ id: bankId }).value();
    if (!bank) return res.status(404).json({ error: '题库不存在' });
    if (req.user.role !== 'admin' && bank.user_id !== req.user.id) {
      return res.status(403).json({ error: '没有权限访问该题库' });
    }
    const qs = db.get('questions').filter({ bank_id: bankId }).value();
    const counts = {};
    qs.forEach(q => { counts[q.type] = (counts[q.type] || 0) + 1; });
    res.json(counts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/submit', authenticate, (req, res) => {
  try {
    const { questionId, userAnswer, selfJudge } = req.body;
    const question = db.get('questions').find({ id: questionId }).value();
    if (!question) return res.status(404).json({ error: '题目不存在' });
    const bank = db.get('questionBanks').find({ id: question.bank_id }).value();
    if (!bank) return res.status(404).json({ error: '题库不存在' });
    if (req.user.role !== 'admin' && bank.user_id !== req.user.id) {
      return res.status(403).json({ error: '没有权限' });
    }

    let isCorrect;
    if (question.type === 'essay' || question.type === 'coding') {
      if (typeof selfJudge !== 'boolean') {
        return res.json({
          requiresSelfJudge: true,
          correctAnswer: question.answer,
          explanation: '主观题请对照参考答案自评'
        });
      }
      isCorrect = selfJudge;
    } else {
      isCorrect = checkAnswer(question, userAnswer);
    }

    db.get('progress').push({
      id: nextId('progress'),
      user_id: req.user.id,
      question_id: questionId,
      is_correct: isCorrect,
      user_answer: userAnswer || '',
      answered_at: new Date().toISOString()
    }).write();

    const existing = db.get('mistakes').find({ user_id: req.user.id, question_id: questionId }).value();
    if (!isCorrect) {
      if (existing) {
        db.get('mistakes').find({ id: existing.id }).assign({
          user_answer: userAnswer || '',
          attempted_at: new Date().toISOString()
        }).write();
      } else {
        db.get('mistakes').push({
          id: nextId('mistakes'),
          user_id: req.user.id,
          question_id: questionId,
          user_answer: userAnswer || '',
          attempted_at: new Date().toISOString()
        }).write();
      }
    } else if (existing) {
      db.get('mistakes').remove({ id: existing.id }).write();
    }

    res.json({
      correct: isCorrect,
      correctAnswer: question.answer,
      explanation: isCorrect ? '回答正确！' : '回答错误，已加入错题本'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/mistakes', authenticate, (req, res) => {
  try {
    const bankId = req.query.bankId ? parseInt(req.query.bankId) : null;
    const type = req.query.type || null;
    const mistakes = db.get('mistakes').filter({ user_id: req.user.id }).value();
    const questions = db.get('questions').value();
    const banks = db.get('questionBanks').value();

    let result = mistakes.map(m => {
      const q = questions.find(x => x.id === m.question_id);
      if (!q) return null;
      const b = banks.find(x => x.id === q.bank_id);
      return {
        ...q,
        user_answer: m.user_answer,
        attempted_at: m.attempted_at,
        bank_name: b ? b.name : '未知题库'
      };
    }).filter(Boolean);

    if (bankId) result = result.filter(m => m.bank_id === bankId);
    if (type && type !== 'all') result = result.filter(m => m.type === type);

    result.sort((a, b) => new Date(b.attempted_at) - new Date(a.attempted_at));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/mistakes/banks', authenticate, (req, res) => {
  try {
    const mistakes = db.get('mistakes').filter({ user_id: req.user.id }).value();
    const questions = db.get('questions').value();
    const banks = db.get('questionBanks').value();
    const map = new Map();
    mistakes.forEach(m => {
      const q = questions.find(x => x.id === m.question_id);
      if (!q) return;
      const b = banks.find(x => x.id === q.bank_id);
      if (!b) return;
      if (!map.has(b.id)) map.set(b.id, { id: b.id, name: b.name, count: 0 });
      map.get(b.id).count++;
    });
    res.json(Array.from(map.values()));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/mistakes/:questionId', authenticate, (req, res) => {
  try {
    const qid = parseInt(req.params.questionId);
    db.get('mistakes').remove({ user_id: req.user.id, question_id: qid }).write();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/stats', authenticate, (req, res) => {
  try {
    const bankId = req.query.bankId ? parseInt(req.query.bankId) : null;
    let banks = db.get('questionBanks').value();
    if (req.user.role !== 'admin') banks = banks.filter(b => b.user_id === req.user.id);
    const bankIds = new Set(banks.map(b => b.id));

    let questions = db.get('questions').value().filter(q => bankIds.has(q.bank_id));
    if (bankId) questions = questions.filter(q => q.bank_id === bankId);
    const qids = new Set(questions.map(q => q.id));

    const progress = db.get('progress').filter({ user_id: req.user.id }).value()
      .filter(p => qids.has(p.question_id));
    const attempted = new Set(progress.map(p => p.question_id)).size;
    const correct = new Set(progress.filter(p => p.is_correct).map(p => p.question_id)).size;
    const mistakes = db.get('mistakes').filter({ user_id: req.user.id }).value()
      .filter(m => qids.has(m.question_id)).length;

    res.json({
      total: questions.length,
      banks: banks.length,
      attempted,
      correct,
      mistakes
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/quiz-state', authenticate, (req, res) => {
  res.json({ ok: true });
});

app.get('/api/admin/users', authenticate, requireAdmin, (req, res) => {
  try {
    const users = db.get('users').value();
    const banks = db.get('questionBanks').value();
    const result = users.map(u => ({
      id: u.id,
      username: u.username,
      role: u.role,
      created_at: u.created_at,
      bank_count: banks.filter(b => b.user_id === u.id).length
    }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/admin/users/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const uid = parseInt(req.params.id);
    if (uid === req.user.id) return res.status(400).json({ error: '不能删除自己' });
    const userBanks = db.get('questionBanks').filter({ user_id: uid }).value();
    const userBankIds = userBanks.map(b => b.id);
    const userQids = db.get('questions').filter(q => userBankIds.includes(q.bank_id)).value().map(q => q.id);
    db.get('questionBanks').remove({ user_id: uid }).write();
    db.get('questions').remove(q => userQids.includes(q.id)).write();
    db.get('mistakes').remove({ user_id: uid }).write();
    db.get('progress').remove({ user_id: uid }).write();
    db.get('sessions').remove({ user_id: uid }).write();
    db.get('users').remove({ id: uid }).write();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/users/:id/reset-password', authenticate, requireAdmin, (req, res) => {
  try {
    const uid = parseInt(req.params.id);
    const { password } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ error: '密码至少6位' });
    const user = db.get('users').find({ id: uid }).value();
    if (!user) return res.status(404).json({ error: '用户不存在' });
    const { hash, salt } = hashPassword(password);
    db.get('users').find({ id: uid }).assign({ password_hash: hash, password_salt: salt }).write();
    db.get('sessions').remove({ user_id: uid }).write();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

if (isProduction) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  if (isProduction) console.log('生产模式：前后端同端口');
});





