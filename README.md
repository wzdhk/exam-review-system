# 大学考试复习系统

一个功能完善的答题系统，支持 PDF、Word、TXT 格式题库导入，覆盖选择 / 多选 / 判断 / 填空 / 简答 / 编程六种题型，内置错题本与学习统计。

## 功能特点

- **一键导入** — 支持 PDF / Word / TXT 题库自动解析
- **多题库管理** — 每个题库独立存储，可单独练习或删除
- **6 种题型** — 单选、多选、判断、填空、简答、编程
- **智能识别** — 自动忽略章节大小标题，标注未识别题块与失败原因
- **即时反馈** — 答题后立即显示正确答案
- **错题本** — 自动收集错题，支持按题库 / 题型筛选练习
- **学习统计** — 实时追踪答题进度与正确率
- **双模式复习** — 查看模式 / 练习模式自由切换
- **账户隔离** — 多用户独立题库，管理员可统一管理

## 项目结构

```
答题系统/
├── README.md
├── package.json
├── vite.config.js
├── index.html
├── db.json                 # lowdb 数据文件（运行时生成）
├── docs/                   # 文档
│   ├── DEPLOYMENT.md       # 部署指南
│   ├── SERVER_SETUP.md     # 服务器初始化
│   ├── USER_GUIDE.md       # 使用指南
│   └── QUESTION_TYPES.md   # 题型与格式说明
├── samples/                # 示例题库
│   └── sample_questions.txt
├── deploy/                 # 部署脚本与 Dockerfile
│   ├── Dockerfile
│   ├── deploy.sh
│   └── deploy.bat
├── server/
│   └── index.js            # Express + lowdb 后端
├── src/                    # React 前端
│   ├── App.jsx
│   ├── main.jsx
│   ├── index.css
│   ├── api.js
│   ├── components/
│   ├── context/
│   └── pages/
└── uploads/                # 上传文件临时目录（自动清理）
```

## 开发环境

```bash
npm install
npm run dev
```

- 前端开发服务器：http://localhost:5173
- 后端 API 服务器：http://localhost:3000

## 生产环境部署

完整部署指南：[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)

### 快速部署

```bash
npm install
npm run build
NODE_ENV=production npm start
```

服务运行在 http://localhost:3000（前后端同端口）。

### 使用部署脚本

```bash
# Linux / macOS
./deploy/deploy.sh

# Windows
deploy\deploy.bat
```

### 使用 PM2

```bash
npm install -g pm2
npm run build
NODE_ENV=production pm2 start server/index.js --name exam-system
pm2 save
```

### 使用 Docker

```bash
docker build -f deploy/Dockerfile -t exam-system .
docker run -d -p 3000:3000 -v $(pwd)/uploads:/app/uploads exam-system
```

## 题库格式说明

完整格式与解析规则：[docs/QUESTION_TYPES.md](./docs/QUESTION_TYPES.md)

示例题库：[samples/sample_questions.txt](./samples/sample_questions.txt)

### 单选题
```
1. 题目内容？
A. 选项A
B. 选项B
C. 选项C
D. 选项D
答案：A
```

### 多选题
```
多选题：以下哪些是面向对象语言？
A. Java
B. C
C. Python
D. C++
答案：ACD
```

### 判断题
```
判断题：数组的索引从 0 开始。
答案：对
```

### 填空题
```
填空题：在 Java 中，___ 关键字用于定义常量
答案：final
```

### 简答题
```
简答题：请简述进程和线程的区别
答案：进程是系统资源分配的基本单位……
```

### 编程题
```
编程题：实现快速排序
答案：
def quick_sort(arr):
    if len(arr) <= 1:
        return arr
    ...
```

## 技术栈

- **前端**：React 18 + React Router + Framer Motion + Vite
- **后端**：Node.js + Express
- **数据库**：lowdb（JSON 文件存储）
- **文件解析**：pdf-parse + mammoth
- **认证**：PBKDF2 + Token Session

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册 |
| POST | `/api/auth/login` | 登录 |
| POST | `/api/auth/logout` | 退出 |
| GET | `/api/auth/me` | 当前用户 |
| POST | `/api/upload` | 上传题库 |
| GET | `/api/question-banks` | 题库列表 |
| DELETE | `/api/question-banks/:id` | 删除题库 |
| GET | `/api/questions` | 获取题目（按 bankId / type 筛选）|
| GET | `/api/questions/types` | 题型计数 |
| POST | `/api/submit` | 提交答案 |
| GET | `/api/mistakes` | 错题列表 |
| DELETE | `/api/mistakes/:questionId` | 移除错题 |
| GET | `/api/stats` | 学习统计 |
| GET | `/api/admin/users` | 用户管理（管理员）|

## 默认账户

首次启动会自动创建管理员账户：

- 用户名：`admin`
- 密码：`admin123`

**首次登录后请立即修改密码。**

## 注意事项

- 题库文件需遵循约定格式，未识别的题块会在上传后列出原因
- 上传的临时文件解析完成后自动删除
- `db.json` 存储所有数据，部署时注意备份
