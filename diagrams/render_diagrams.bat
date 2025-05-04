@echo off
echo Audio Listener AI - Diagram Renderer
echo ===================================
echo.
echo This script will render all diagrams to high-quality images.
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/
    goto :EOF
)

REM Check if mermaid-cli is installed
where mmdc >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Mermaid CLI not found. Installing...
    npm install -g @mermaid-js/mermaid-cli
    if %ERRORLEVEL% neq 0 (
        echo Error: Failed to install Mermaid CLI.
        goto :EOF
    )
)

echo Rendering diagrams to high-quality images...
echo.
node render_high_quality_diagrams.js

echo.
echo Done! Check the 'images' folder for the rendered diagrams.
echo.
echo Note: SVG files provide the best quality for viewing and embedding in documents.
echo PNG files are provided for compatibility with applications that don't support SVG.
echo.
pause
