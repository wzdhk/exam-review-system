# 答题系统 - 服务器部署快速指南

## 上传文件到服务器

### 使用 SCP (Linux/Mac)
```bash
# 压缩项目
tar -czf exam-system.tar.gz 答题系统/

# 上传到服务器
scp exam-system.tar.gz username@your-server-ip:/path/to/destination/

# SSH 登录服务器
ssh username@your-server-ip

# 解压
cd /path/to/destination/
tar -xzf exam-system.tar.gz
cd 答题系统
```

### 使用 FileZilla/WinSCP (Windows)
1. 连接到服务器
2. 上传整个 `答题系统` 文件夹
3. SSH 登录服务器

## 服务器上的部署步骤

### 1. 确保已安装 Node.js
```bash
# 检查版本
node -v

# 如果没有安装，Ubuntu/Debian 安装方法：
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS 安装方法：
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

### 2. 运行部署脚本
```bash
cd 答题系统
chmod +x deploy.sh
./deploy.sh
```

### 3. 配置防火墙
```bash
# Ubuntu/Debian
sudo ufw allow 3000/tcp
sudo ufw enable

# CentOS
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

### 4. 使用 PM2 管理进程（推荐）
```bash
# 安装 PM2
npm install -g pm2

# 启动服务
cd 答题系统
NODE_ENV=production pm2 start server/index.js --name exam-system

# 设置开机自启
pm2 startup
pm2 save

# 查看状态
pm2 status
pm2 logs exam-system
```

## 配置域名访问（可选）

### 使用 Nginx 反向代理

1. 安装 Nginx：
```bash
sudo apt install nginx  # Ubuntu/Debian
```

2. 创建配置文件：
```bash
sudo nano /etc/nginx/sites-available/exam-system
```

3. 添加以下内容：
```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

4. 启用配置：
```bash
sudo ln -s /etc/nginx/sites-available/exam-system /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

5. 配置防火墙允许 HTTP/HTTPS：
```bash
sudo ufw allow 'Nginx Full'
```

## 访问系统

- 直接访问：`http://your-server-ip:3000`
- 使用域名：`http://your-domain.com`（配置 Nginx 后）

## 常见问题

### 端口已被占用
```bash
# 查看占用端口的进程
sudo netstat -tulpn | grep 3000

# 或使用
sudo lsof -i :3000

# 杀死进程
sudo kill -9 <PID>
```

### 权限问题
```bash
# 确保当前用户有权限
sudo chown -R $USER:$USER 答题系统
chmod -R 755 答题系统
```

### 查看日志
```bash
# PM2 日志
pm2 logs exam-system

# 如果直接运行
NODE_ENV=production npm start
```

## 数据备份

```bash
# 备份数据库文件
cp db.json db.json.backup

# 定时备份（添加到 crontab）
0 2 * * * cp /path/to/答题系统/db.json /path/to/backups/db_$(date +\%Y\%m\%d).json
```

## 更新系统

```bash
# 停止服务
pm2 stop exam-system

# 拉取新代码或上传新文件
# ...

# 重新构建
npm install
npm run build

# 重启服务
pm2 restart exam-system
```

## 完整示例

以下是一个完整的部署命令序列：

```bash
# 1. 上传文件后，登录服务器
ssh username@your-server-ip

# 2. 进入项目目录
cd /path/to/答题系统

# 3. 安装 PM2
npm install -g pm2

# 4. 运行部署脚本
chmod +x deploy.sh
./deploy.sh

# 5. 使用 PM2 启动
NODE_ENV=production pm2 start server/index.js --name exam-system

# 6. 设置开机自启
pm2 startup
pm2 save

# 7. 配置防火墙
sudo ufw allow 3000/tcp
sudo ufw enable

# 8. 查看状态
pm2 status

# 完成！访问 http://your-server-ip:3000
```
