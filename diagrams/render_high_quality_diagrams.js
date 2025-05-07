/**
 * High-Quality Diagram Rendering Script
 *
 * This script renders Mermaid diagrams from Markdown files to SVG vector files.
 * It requires Node.js and the @mermaid-js/mermaid-cli package.
 *
 * Installation:
 * npm install -g @mermaid-js/mermaid-cli
 *
 * Usage:
 * node render_high_quality_diagrams.js
 *
 * Output:
 * - SVG files (vector format, best quality)
 */

const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

// Configuration
const diagramsDir = __dirname;
const outputDir = path.join(diagramsDir, "images");
const fileExtension = ".md";

// Output format configuration
const outputFormat = { ext: ".svg", type: "svg" };

// Rendering configuration
const renderConfig = {
  backgroundColor: "white", // Background color (white often looks better than transparent for diagrams)
  theme: "default", // Mermaid theme
  width: 1920, // Width in pixels
  height: 1080, // Height in pixels (will adjust automatically if content is larger)
  fontFamily: "arial", // Font family
  fontSize: 16, // Base font size
};

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
  const baseName = file.replace(fileExtension, "");

  console.log(`Processing ${file}...`);

  // Read the file content
  const content = fs.readFileSync(filePath, "utf8");

  // Extract Mermaid diagram code
  const mermaidMatch = content.match(/```mermaid\n([\s\S]*?)\n```/);

  if (mermaidMatch && mermaidMatch[1]) {
    const mermaidCode = mermaidMatch[1];
    const tempMermaidFile = path.join(outputDir, `temp_${baseName}.mmd`);

    // Write the Mermaid code to a temporary file
    fs.writeFileSync(tempMermaidFile, mermaidCode);

    // Create a config file for mermaid-cli
    const configFile = path.join(outputDir, `temp_${baseName}_config.json`);
    fs.writeFileSync(
      configFile,
      JSON.stringify({
        theme: renderConfig.theme,
        backgroundColor: renderConfig.backgroundColor,
        width: renderConfig.width,
        height: renderConfig.height,
        fontFamily: renderConfig.fontFamily,
        fontSize: renderConfig.fontSize,
      })
    );

    const outputFilePath = path.join(
      outputDir,
      `${baseName}${outputFormat.ext}`
    );

    // Build command for SVG rendering
    const command = `mmdc -i "${tempMermaidFile}" -o "${outputFilePath}" -c "${configFile}"`;

    console.log(`Rendering ${baseName} to SVG...`);

    // Execute the command
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error rendering ${file} to SVG: ${error.message}`);
        return;
      }

      if (stderr && !stderr.includes("Generating")) {
        console.error(`Warning while rendering ${file}: ${stderr}`);
      }

      console.log(`Successfully rendered ${file} to SVG: ${outputFilePath}`);
    });

    // Set up cleanup of temporary files after a delay
    setTimeout(() => {
      try {
        if (fs.existsSync(tempMermaidFile)) {
          fs.unlinkSync(tempMermaidFile);
        }
        if (fs.existsSync(configFile)) {
          fs.unlinkSync(configFile);
        }
      } catch (err) {
        console.warn(
          `Warning: Could not clean up temporary files: ${err.message}`
        );
      }
    }, 5000); // Wait 5 seconds to ensure rendering is complete
  } else {
    console.warn(`No Mermaid diagram found in ${file}`);
  }
});

console.log(
  "Rendering process started. Check the images directory for output files."
);
console.log(
  "Note: SVG files provide vector-based output for perfect quality at any scale."
);
