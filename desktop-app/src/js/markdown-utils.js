/**
 * Markdown utilities for consistent rendering across the application
 */

/**
 * Safely parses markdown content to HTML using the marked library
 * Falls back to basic formatting if marked is not available
 * @param {string} content - The markdown content to parse
 * @param {boolean} [isError=false] - Whether this is error content (skips markdown parsing)
 * @returns {string} - The HTML formatted content
 */
function parseMarkdown(content, isError = false) {
  if (!content) return '';
  
  try {
    // Use marked library if available and not error content
    if (typeof marked !== "undefined" && !isError) {
      return marked.parse(content);
    } else {
      // Basic fallback formatting
      return content
        .replace(/\n\n/g, "<br><br>")
        .replace(/\n/g, "<br>");
    }
  } catch (error) {
    console.error("Error parsing markdown:", error);
    // Return the original content with basic formatting as a fallback
    return content
      .replace(/\n\n/g, "<br><br>")
      .replace(/\n/g, "<br>");
  }
}

/**
 * Determines if a string contains markdown-like syntax
 * @param {string} text - The text to check
 * @returns {boolean} - True if the text contains markdown syntax
 */
function containsMarkdown(text) {
  if (!text) return false;
  return /[*_`#\[\]\(\)]/.test(text);
}

/**
 * Renders content in the specified element with proper markdown formatting
 * @param {HTMLElement} element - The element to render content in
 * @param {string} content - The markdown content to render
 * @param {boolean} [isError=false] - Whether this is error content
 */
function renderMarkdownInElement(element, content, isError = false) {
  if (!element) {
    console.error("Cannot render markdown: target element is null");
    return;
  }
  
  try {
    element.innerHTML = parseMarkdown(content, isError);
  } catch (error) {
    console.error("Error rendering markdown in element:", error);
    // Fallback to basic text
    element.textContent = content;
  }
}

// Export the functions to the global scope for use in other modules
window.markdownUtils = {
  parseMarkdown,
  containsMarkdown,
  renderMarkdownInElement
};
