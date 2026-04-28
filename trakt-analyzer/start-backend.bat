@echo off
cd /d "c:\Users\Tom\Desktop\12ss\trakt-analyzer"
echo [后端服务] Trakt Analyzer Server
start "Trakt-Backend" /B node server/index.js
echo 后端已启动 (http://localhost:3001)
echo 按任意键关闭后端...
pause >nul
taskkill /f /im node.exe 2>nul
echo 后端已关闭
