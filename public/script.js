const socket = io();
let isRecording = false;

socket.on("processing", () => {
  document.getElementById("loading").style.display = "block";
});

socket.on("update", (data) => {
  document.getElementById("loading").style.display = "none";
  document.getElementById(
    "question"
  ).innerHTML = `<strong>Question:</strong> ${data.transcript}`;
  document.getElementById(
    "answer"
  ).innerHTML = `<strong>Answer:</strong> ${marked.parse(data.answer)}`;
});

socket.on("error", (message) => {
  document.getElementById("loading").style.display = "none";
  console.error("Processing error:", message);
});

function toggleRecording() {
  const btn = document.getElementById("toggleBtn");
  const status = document.getElementById("status");
  const loading = document.getElementById("loading");
  // grab the selected language each time
  const lang = document.querySelector('input[name="language"]:checked').value;
  // get the selected speech speed
  const speechSpeed =
    document.querySelector('select[name="speechSpeed"]').value || "normal";

  if (!isRecording) {
    fetch("/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: lang,
        speechSpeed: speechSpeed,
        duration: 60, // Increase default recording duration to 60 seconds
      }),
    });
    btn.textContent = "Stop Listening";
    status.className = "status recording";
    status.textContent = "Status: Recording...";
    loading.style.display = "none";
  } else {
    fetch("/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: lang,
        speechSpeed: speechSpeed,
      }),
    });
    btn.textContent = "Start Listening";
    status.className = "status idle";
    status.textContent = "Status: Idle";
    loading.style.display = "block"; // show processing immediately
  }
  isRecording = !isRecording;
}
