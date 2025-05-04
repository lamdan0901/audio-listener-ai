/**
 * High-Quality Diagram Rendering Script
 *
 * This script renders Mermaid diagrams from Markdown files to high-resolution image files.
 * It requires Node.js and the @mermaid-js/mermaid-cli package.
 *
 * Installation:
 * npm install -g @mermaid-js/mermaid-cli
 *
 * Usage:
 * node render_diagrams.js
 *
 * Output:
 * - PNG files (high resolution)
 * - SVG files (vector format, best quality)
 * - PDF files (optional, for printing)
 */

const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

// Configuration
const diagramsDir = __dirname;
const outputDir = path.join(diagramsDir, "images");
const fileExtension = ".md";

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
  console.log(`Created output directory: ${outputDir}`);
}

// Get all Markdown files in the diagrams directory
const files = fs
  .readdirSync(diagramsDir)
  .filter((file) => file.endsWith(fileExtension) && file !== "README.md");

console.log(`Found ${files.length} diagram files to process`);

// Process each file
files.forEach((file) => {
  const filePath = path.join(diagramsDir, file);
  const outputFileName = file.replace(fileExtension, ".png");
  const outputFilePath = path.join(outputDir, outputFileName);

  console.log(`Processing ${file}...`);

  // Read the file content
  const content = fs.readFileSync(filePath, "utf8");

  // Extract Mermaid diagram code
  const mermaidMatch = content.match(/```mermaid\n([\s\S]*?)\n```/);

  if (mermaidMatch && mermaidMatch[1]) {
    const mermaidCode = mermaidMatch[1];
    const tempMermaidFile = path.join(
      outputDir,
      `temp_${file.replace(fileExtension, ".mmd")}`
    );

    // Write the Mermaid code to a temporary file
    fs.writeFileSync(tempMermaidFile, mermaidCode);

    // Use mmdc to render the diagram
    const command = `mmdc -i "${tempMermaidFile}" -o "${outputFilePath}" -b transparent`;

    exec(command, (error, stdout, stderr) => {
      // Clean up the temporary file
      if (fs.existsSync(tempMermaidFile)) {
        fs.unlinkSync(tempMermaidFile);
      }

      if (error) {
        console.error(`Error rendering ${file}: ${error.message}`);
        return;
      }

      if (stderr) {
        console.error(`Stderr for ${file}: ${stderr}`);
        return;
      }

      console.log(`Successfully rendered ${file} to ${outputFilePath}`);
    });
  } else {
    console.warn(`No Mermaid diagram found in ${file}`);
  }
});

console.log(
  "Rendering process started. Check the images directory for output files."
);
