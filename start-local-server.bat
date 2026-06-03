@echo off
setlocal

if "%PORT%"=="" set "PORT=3100"
if "%RISK_LIBRARY_ROOT%"=="" set "RISK_LIBRARY_ROOT=C:\Users\patpat\Documents\image-ip-risk-library"
if "%ADMIN_TOKEN%"=="" set "ADMIN_TOKEN=PatPatAdmin2026!"

echo.
echo 正在启动图像侵权风险系统...
echo 端口: %PORT%
echo 图库根目录: %RISK_LIBRARY_ROOT%
if not "%ADMIN_TOKEN%"=="" (
  echo 管理端令牌: 已设置
) else (
  echo 管理端令牌: 未设置
)
echo.

node server.js

endlocal
