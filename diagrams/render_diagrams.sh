#!/bin/bash

echo "Audio Listener AI - Diagram Renderer"
echo "==================================="
echo ""
echo "This script will render all diagrams to high-quality images."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed."
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if mermaid-cli is installed
if ! command -v mmdc &> /dev/null; then
    echo "Mermaid CLI not found. Installing..."
    npm install -g @mermaid-js/mermaid-cli
    if [ $? -ne 0 ]; then
        echo "Error: Failed to install Mermaid CLI."
        exit 1
    fi
fi

echo "Rendering diagrams to high-quality images..."
echo ""
node render_high_quality_diagrams.js

echo ""
echo "Done! Check the 'images' folder for the rendered diagrams."
echo ""
echo "Note: SVG files provide the best quality for viewing and embedding in documents."
echo "PNG files are provided for compatibility with applications that don't support SVG."
echo ""
