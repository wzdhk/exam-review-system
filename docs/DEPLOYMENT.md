# 生产环境部署指南

## 部署前准备

### 1. 服务器要求
- Node.js 14+ 
- 至少 512MB RAM
- 至少 1GB 磁盘空间

### 2. 安装依赖
```bash
npm install --production
```

## 部署步骤

### 方式一：使用 PM2（推荐）

#### 1. 安装 PM2
```bash
npm install -g pm2
```

#### 2. 构建前端
```bash
npm run build
```

#### 3. 启动服务
```bash
NODE_ENV=production pm2 start server/index.js --name exam-system
```

#### 4. 设置开机自启
```bash
pm2 startup
pm2 save
```

#### 5. 查看日志
```bash
pm2 logs exam-system
```

#### 6. 重启服务
```bash
pm2 restart exam-system
```

### 方式二：使用 systemd

#### 1. 构建前端
```bash
npm run build
```

#### 2. 创建 systemd 服务文件
```bash
sudo nano /etc/systemd/system/exam-system.service
```

内容：
```ini
[Unit]
Description=Exam Review System
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/答题系统
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/node server/index.js
Restart=always

[Install]
WantedBy=multi-user.target
```

#### 3. 启动服务
```bash
sudo systemctl daemon-reload
sudo systemctl start exam-system
sudo systemctl enable exam-system
```

#### 4. 查看状态
```bash
sudo systemctl status exam-system
```

### 方式三：使用 Docker

#### 1. 创建 Dockerfile（已包含在项目中）
见项目根目录的 `Dockerfile`

#### 2. 构建镜像
```bash
docker build -t exam-system .
```

#### 3. 运行容器
```bash
docker run -d \
  --name exam-system \
  -p 3000:3000 \
  -v $(pwd)/db.json:/app/db.json \
  -v $(pwd)/uploads:/app/uploads \
  exam-system
```

## 使用 Nginx 反向代理（推荐）

### 1. 安装 Nginx
```bash
sudo apt install nginx  # Ubuntu/Debian
# 或
sudo yum install nginx  # CentOS
```

### 2. 配置 Nginx
创建配置文件：
```bash
sudo nano /etc/nginx/sites-available/exam-system
```

内容：
```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名

    client_max_body_size 50M;  # 允许上传大文件

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. 启用配置
```bash
sudo ln -s /etc/nginx/sites-available/exam-system /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. 配置 HTTPS（可选但推荐）
使用 Let's Encrypt 免费证书：
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 环境变量配置

创建 `.env` 文件（不要提交到 Git）：
```bash
cp .env.example .env
nano .env
```

修改以下配置：
```
NODE_ENV=production
PORT=3000
```

## 防火墙配置

### Ubuntu/Debian (ufw)
```bash
sudo ufw allow 3000/tcp
sudo ufw allow 'Nginx Full'  # 如果使用 Nginx
sudo ufw enable
```

### CentOS (firewalld)
```bash
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

## 数据备份

### 自动备份脚本
创建 `backup.sh`：
```bash
#!/bin/bash
BACKUP_DIR="/path/to/backups"
DATE=$(date +%Y%m%d_%H%M%S)
cp db.json "$BACKUP_DIR/db_$DATE.json"
find "$BACKUP_DIR" -name "db_*.json" -mtime +7 -delete
```

设置定时任务：
```bash
crontab -e
```
添加：
```
0 2 * * * /path/to/backup.sh
```

## 性能优化

### 1. 使用 Nginx 缓存静态文件
在 Nginx 配置中添加：
```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
    proxy_pass http://localhost:3000;
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 2. 启用 Gzip 压缩
```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
gzip_min_length 1000;
```

## 监控和日志

### 查看 PM2 日志
```bash
pm2 logs exam-system
pm2 monit
```

### 查看 systemd 日志
```bash
sudo journalctl -u exam-system -f
```

### 查看 Nginx 日志
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## 故障排查

### 服务无法启动
1. 检查端口是否被占用：`sudo netstat -tulpn | grep 3000`
2. 检查权限：确保用户有读写 db.json 和 uploads 目录的权限
3. 检查 Node.js 版本：`node --version`

### 文件上传失败
1. 检查 uploads 目录权限：`chmod 755 uploads`
2. 检查磁盘空间：`df -h`
3. 检查 Nginx 上传大小限制

### 数据库文件损坏
从备份恢复：
```bash
cp /path/to/backups/db_YYYYMMDD_HHMMSS.json db.json
```

## 访问地址

部署完成后：
- 如果使用 Nginx：访问 `http://your-domain.com`
- 如果直接访问：访问 `http://your-server-ip:3000`

## 安全建议

1. ✅ 使用 HTTPS（Let's Encrypt）
2. ✅ 配置防火墙，只开放必要端口
3. ✅ 定期更新系统和依赖包
4. ✅ 设置数据库文件权限为 600
5. ✅ 定期备份数据
6. ✅ 使用环境变量存储敏感信息
7. ✅ 限制上传文件大小和类型

## 多用户注意事项

当前系统设计为单数据库多用户共享：
- 所有用户看到相同的题库
- 每个用户的答题记录和错题本是独立的（基于 session）

如果需要多用户隔离，建议：
1. 添加用户认证系统
2. 在数据库中添加 user_id 字段
3. 根据登录用户过滤数据

## 支持

遇到问题？检查：
1. Node.js 版本是否 >= 14
2. 是否运行了 `npm run build`
3. 环境变量是否正确设置
4. 防火墙和端口是否正确配置
