@echo off
title RukunKu - Local Server
powershell -ExecutionPolicy Bypass -File "%~dp0start-http-server.ps1"
pause
