@echo off
chcp 65001 >nul

REM 切换到项目根目录（脚本位于 deploy/ 子目录）
cd /d "%~dp0\.."

echo ======================================
echo    答题系统 - 生产环境部署脚本
echo ======================================
echo.

REM 检查 Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo 错误: 未找到 Node.js，请先安装 Node.js 14+
    pause
    exit /b 1
)

echo ✓ Node.js 版本:
node -v
echo.

REM 安装依赖
echo 步骤 1/3: 安装依赖...
call npm install
if %ERRORLEVEL% neq 0 (
    echo 错误: 依赖安装失败
    pause
    exit /b 1
)
echo ✓ 依赖安装完成
echo.

REM 构建前端
echo 步骤 2/3: 构建前端...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo 错误: 前端构建失败
    pause
    exit /b 1
)
echo ✓ 前端构建完成
echo.

REM 创建必要的目录
echo 步骤 3/3: 创建运行目录...
if not exist "uploads" mkdir uploads
echo ✓ 目录创建完成
echo.

REM 检查是否安装了 PM2
where pm2 >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo 检测到 PM2，是否使用 PM2 启动服务？(Y/N^)
    set /p use_pm2=
    if /i "%use_pm2%"=="Y" (
        echo 使用 PM2 启动服务...
        set NODE_ENV=production
        pm2 start server/index.js --name exam-system
        pm2 save
        echo.
        echo ======================================
        echo    部署完成！
        echo ======================================
        echo.
        echo 服务已使用 PM2 启动
        echo 访问地址: http://localhost:3000
        echo.
        echo 常用命令:
        echo   pm2 logs exam-system     - 查看日志
        echo   pm2 restart exam-system  - 重启服务
        echo   pm2 stop exam-system     - 停止服务
        echo   pm2 monit                - 监控服务
        pause
        exit /b 0
    )
)

echo ======================================
echo    部署完成！
echo ======================================
echo.
echo 启动服务 (在新的命令提示符窗口中运行):
echo   set NODE_ENV=production
echo   npm start
echo.
echo 或使用 PM2 (推荐):
echo   npm install -g pm2
echo   set NODE_ENV=production
echo   pm2 start server/index.js --name exam-system
echo.
echo 访问地址: http://localhost:3000
echo.
echo 详细部署指南: 查看 docs/DEPLOYMENT.md
echo.
pause
