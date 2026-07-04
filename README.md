# 大学考试复习系统

一个面向大学生的在线答题系统，支持 PDF、Word、TXT 格式题库导入，覆盖单选 / 多选 / 判断 / 填空 / 简答五种题型，内置错题本、学习统计与管理员后台。

**线上地址：** https://houxiaoheng.cn（审核阶段）
http://81.71.129.156:3000/（可用）
## 功能特点

**答题核心**
- 支持 PDF / Word / TXT 题库一键导入，自动解析题目与答案
- 单选、多选、判断、填空、简答五种题型全覆盖
- 答题后即时显示正确答案，填空 / 简答支持忽略标点差异自动判分
- 中途退出进度自动保存，下次打开接续上次位置
- 错题本自动收集，支持按题库 / 题型筛选专项练习
- 实时统计答题进度与正确率

**题库管理**
- 多用户独立题库，各自隔离互不影响
- 管理员可将指定题库公开给所有用户访问
- 管理员可用新文件直接替换题库题目（保留题库名称和 ID）

**管理员后台**
- 用户管理：查看在线时长、最后在线时间、答题记录、正确率
- 公告栏：发布公告，所有用户首页可见，支持单条关闭
- 角色管理：普通用户与管理员之间互相切换
- 题库管理：公开/私有切换、替换题目、删除题库
- 实时在线人数统计（30 秒心跳，关闭页面即停止计时）

## 题库格式说明

示例：[samples/sample_questions.txt](./samples/sample_questions.txt)

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

多个可接受答案用 `/` 分隔，填空题和简答题判分时自动忽略标点符号差异。

## 开发环境

```bash
npm install
npm run dev
```

- 前端：http://localhost:5173
- 后端 API：http://localhost:3000

## 生产部署

```bash
npm install
npm run build
NODE_ENV=production pm2 start server/index.js --name exam-system
pm2 save
```

服务运行在 http://localhost:3000（前后端同端口），配合 Nginx 反代与 Let's Encrypt HTTPS 使用。

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
| POST | `/api/heartbeat` | 在线心跳 |
| POST | `/api/upload` | 上传题库 |
| GET | `/api/question-banks` | 题库列表 |
| DELETE | `/api/question-banks/:id` | 删除题库 |
| POST | `/api/question-banks/:id/visibility` | 切换公开状态（管理员）|
| GET | `/api/questions` | 获取题目 |
| POST | `/api/submit` | 提交答案 |
| GET | `/api/mistakes` | 错题列表 |
| GET | `/api/stats` | 学习统计 |
| GET | `/api/announcements` | 公告列表 |
| GET | `/api/admin/users` | 用户列表（管理员）|
| GET | `/api/admin/users/:id/stats` | 用户答题记录（管理员）|
| POST | `/api/admin/users/:id/toggle-role` | 切换角色（管理员）|
| POST | `/api/admin/announcements` | 发布公告（管理员）|
| DELETE | `/api/admin/announcements/:id` | 删除公告（管理员）|
| POST | `/api/admin/question-banks/:id/replace` | 替换题库题目（管理员）|

## 默认账户

首次启动自动创建管理员账户：`admin` / `admin123`，首次登录后请立即修改密码。

## 注意事项

- 题库文件需遵循约定格式，未识别的题块会在上传后列出原因
- `db.json` 存储所有数据，部署时注意备份
- 上传的临时文件解析完成后自动删除
