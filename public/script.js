const logs = document.getElementById("logs");
const input = document.getElementById("commandInput");
const btn = document.getElementById("sendCommand");
const statusText = document.getElementById("statusText");

// 🔥 CHANGE THIS TO YOUR HOSTED BACKEND URL (NOT localhost)
const socket = io("");

// =====================
// CONNECTION STATUS
// =====================
socket.on("connect", () => {
    addLog("✅ Connected to bot server");
    statusText.innerText = "Online";
    statusText.style.color = "lime";
});

socket.on("disconnect", () => {
    addLog("❌ Disconnected from bot server");
    statusText.innerText = "Offline";
    statusText.style.color = "red";
});

// =====================
// BOT LOGS
// =====================
socket.on("log-update", (msg) => {
    addLog(msg);

    if (msg.includes("Online")) {
        statusText.innerText = "Bot Online";
        statusText.style.color = "lime";
    }

    if (msg.includes("Disconnected")) {
        statusText.innerText = "Bot Offline";
        statusText.style.color = "red";
    }
});

// =====================
// SEND COMMANDS
// =====================
btn.addEventListener("click", sendCommand);

input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendCommand();
});

function sendCommand() {
    const cmd = input.value.trim().toLowerCase();

    if (!cmd) return;

    if (cmd === "start") {
        socket.emit("bot-action", "start");
        addLog("📤 Sent: START");
    } 
    else if (cmd === "restart") {
        socket.emit("bot-action", "restart");
        addLog("📤 Sent: RESTART");
    } 
    else {
        addLog("⚠ Only START / RESTART allowed");
    }

    input.value = "";
}

// =====================
// LOG UI
// =====================
function addLog(text) {
    const div = document.createElement("div");
    div.className = "log-entry";
    div.innerText = text;

    logs.appendChild(div);
    logs.scrollTop = logs.scrollHeight;
}
