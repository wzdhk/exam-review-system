# 使用 Node.js 18 基础镜像
# 构建命令（在项目根目录执行）：docker build -f deploy/Dockerfile -t exam-system .
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装生产依赖
RUN npm ci --only=production

# 复制源代码
COPY . .

# 构建前端
RUN npm run build

# 创建必要的目录
RUN mkdir -p uploads

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 启动应用
CMD ["node", "server/index.js"]
