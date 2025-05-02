// Animation state
let previousContent = "";
let animationInProgress = false;
let animationQueue = [];
let streamedContent = ""; // Variable to accumulate streamed content

/**
 * Resets all animation state variables to their initial values.
 * Clears previous content, animation status, queue, and streamed content.
 */
function resetAnimationState() {
  previousContent = "";
  animationInProgress = false;
  animationQueue = [];
  streamedContent = "";
}

/**
 * Animates text character by character with a typewriter effect.
 * @param {HTMLElement} element - The DOM element to animate text within
 * @param {string} text - The complete text to animate
 * @param {number} startIndex - The starting position in the text to animate from
 * @param {Function} [callback] - Optional callback function to execute when animation completes
 */
function animateText(element, text, startIndex, callback) {
  if (startIndex < text.length) {
    // Calculate how many characters to add in this step (variable speed typing)
    const charsToAdd = Math.floor(Math.random() * 3) + 1; // Add 1-3 characters at a time
    const nextIndex = Math.min(startIndex + charsToAdd, text.length);

    // Get the new chunk of text and wrap each character in a span for animation
    const newChars = text.substring(startIndex, nextIndex);
    let newContent = text.substring(0, startIndex);

    // Add the new characters with animation spans
    for (let i = 0; i < newChars.length; i++) {
      const delay = i * 50; // Stagger animation for each character
      newContent += `<span class="typing-char" style="animation-delay: ${delay}ms">${newChars[i]}</span>`;
    }

    // Maintain the rest of the text without animation
    newContent += text.substring(nextIndex);

    element.innerHTML = newContent;

    // Add cursor at the end
    const cursor = document.createElement("span");
    cursor.className = "typing-cursor";
    element.appendChild(cursor);

    // Schedule next batch with a variable delay for more natural typing
    // Make the delay depend on content type - pause longer at punctuation
    let delay = 20; // Base delay

    // Slow down at punctuation marks or new paragraph markers
    const lastChar = newChars[newChars.length - 1];
    if ([".", "!", "?", ":", ";", "\n"].includes(lastChar)) {
      delay = Math.floor(Math.random() * 250) + 200; // 200-450ms pause
    } else if ([","].includes(lastChar)) {
      delay = Math.floor(Math.random() * 150) + 100; // 100-250ms pause
    } else {
      delay = Math.floor(Math.random() * 30) + 10; // 10-40ms normal typing speed
    }

    setTimeout(() => {
      animateText(element, text, nextIndex, callback);
    }, delay);
  } else {
    // Animation complete, remove special spans and styling
    element.innerHTML = text;
    if (callback) callback();
  }
}

/**
 * Processes the next animation in the queue.
 * Handles the animation flow and manages the animation state.
 * Processes initial content differently from subsequent updates.
 */
function processNextAnimation() {
  if (animationQueue.length === 0) {
    animationInProgress = false;
    return;
  }

  animationInProgress = true;
  const nextContent = animationQueue.shift();

  // Get the container element
  const contentElement = document.getElementById("streamingContent");

  // Handle initial content
  if (!contentElement.innerHTML.trim()) {
    // For the first content update, we can set it directly but wrapped in a div
    // to ensure proper styling and animations
    const contentWrapper = document.createElement("div");
    contentWrapper.classList.add("animated-content");
    contentWrapper.innerHTML = nextContent;
    contentElement.appendChild(contentWrapper);

    // Add a subtle entrance animation for the initial content
    contentWrapper.style.animation = "smoothFadeIn 0.3s ease-in-out";

    // Add the cursor element at the end
    appendCursor(contentElement);

    // If there are more animations, process the next one
    if (animationQueue.length > 0) {
      setTimeout(processNextAnimation, 50);
    } else {
      animationInProgress = false;
    }
    return;
  }

  // Parse both current and new content to detect differences
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = nextContent;

  // Handle the content update with minimal DOM changes
  updateContentSmoothly(contentElement, tempDiv);

  // If there are more animations in the queue, process the next one with a variable delay
  // Use a longer delay if we have substantial changes (to make it easier to read)
  const contentChanged = contentElement.innerHTML !== tempDiv.innerHTML;
  const delayTime = contentChanged ? 100 : 30; // Longer delay for bigger changes

  if (animationQueue.length > 0) {
    setTimeout(processNextAnimation, delayTime);
  } else {
    animationInProgress = false;
  }
}

/**
 * Updates content with minimal DOM changes to reduce flashing.
 * Intelligently updates only changed parts of the DOM.
 * @param {HTMLElement} currentElement - The current DOM element to update
 * @param {HTMLElement} newContentElement - The new content element with updated HTML
 */
function updateContentSmoothly(currentElement, newContentElement) {
  // Identify and update only the changed parts
  // This function tries to be smart about updating only what has changed

  // Find all top-level elements in both current and new content
  const currentChildren = Array.from(currentElement.children);
  const newChildren = Array.from(newContentElement.children);

  // If new content has more elements than current content
  // Just append the new elements with a fade-in animation
  if (newChildren.length > currentChildren.length) {
    for (let i = currentChildren.length; i < newChildren.length; i++) {
      const newNode = newChildren[i].cloneNode(true);
      newNode.classList.add("new-content");
      currentElement.appendChild(newNode);
    }
  }

  // Update existing elements with their new content
  // This keeps the DOM structure intact and reduces flashing
  for (
    let i = 0;
    i < Math.min(currentChildren.length, newChildren.length);
    i++
  ) {
    if (currentChildren[i].tagName === newChildren[i].tagName) {
      // Only update if content has changed
      if (currentChildren[i].innerHTML !== newChildren[i].innerHTML) {
        // For code blocks, we need special treatment
        if (currentChildren[i].tagName === "PRE") {
          updateCodeBlock(currentChildren[i], newChildren[i]);
        } else {
          currentChildren[i].innerHTML = newChildren[i].innerHTML;
        }
      }
    } else {
      // If tag types are different, replace the element
      const newNode = newChildren[i].cloneNode(true);
      newNode.classList.add("new-content");
      currentElement.replaceChild(newNode, currentChildren[i]);
    }
  }

  // Add cursor at the end
  appendCursor(currentElement);
}

/**
 * Special handling for code blocks to make them animate smoothly.
 * Preserves scroll position when updating code blocks.
 * @param {HTMLElement} currentBlock - The current code block element
 * @param {HTMLElement} newBlock - The new code block with updated content
 */
function updateCodeBlock(currentBlock, newBlock) {
  // Preserve scroll position and other attributes
  const wasScrolled = currentBlock.scrollTop > 0;
  const scrollTop = currentBlock.scrollTop;

  // Update content
  currentBlock.innerHTML = newBlock.innerHTML;

  // Restore scroll position if needed
  if (wasScrolled) {
    currentBlock.scrollTop = scrollTop;
  }
}

/**
 * Adds a blinking cursor at the end of the content.
 * Finds the appropriate element to append the cursor to.
 * @param {HTMLElement} element - The container element to add the cursor to
 */
function appendCursor(element) {
  // Remove any existing cursors
  const existingCursors = element.querySelectorAll(".typing-cursor");
  existingCursors.forEach((cursor) => cursor.remove());

  // Find the last text-containing element to append the cursor to
  let lastElement = element;

  // Try to find the last paragraph, list item, or code block
  const possibleTargets = element.querySelectorAll(
    "p, li, pre, h1, h2, h3, h4, h5, h6"
  );
  if (possibleTargets.length > 0) {
    lastElement = possibleTargets[possibleTargets.length - 1];
  }

  // Create and append the cursor
  const cursor = document.createElement("span");
  cursor.className = "typing-cursor";
  lastElement.appendChild(cursor);
}
