@echo off
echo Starting the Futures Signal Analyzer and Telegram Server...

:: Start the Execution Server in this window
start "" "index.html"
node server.js

pause
