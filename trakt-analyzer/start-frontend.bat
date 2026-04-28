@echo off
cd /d "c:\Users\Tom\Desktop\12ss\trakt-analyzer"
echo [前端服务] Vite Dev Server
start "Trakt-Frontend" /B npx vite --host
echo 前端已启动 (http://localhost:5173)
echo 按任意键关闭前端...
pause >nul
taskkill /f /im node.exe 2>nul
echo 前端已关闭
