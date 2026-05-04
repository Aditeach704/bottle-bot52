// V11 FULL BOT UPGRADE + WEB LINK
require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mineflayer = require('mineflayer');
const { pathfinder, goals, Movements } = require('mineflayer-pathfinder');
const autoeat = require('mineflayer-auto-eat').loader;
const { GoogleGenAI } = require("@google/genai");
const sqlite3 = require("sqlite3").verbose();

// =======================
// WEB SERVER (THE LINK)
// =======================
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "https://bottle-pixel-bot.pages.dev",
        methods: ["GET", "POST"]
    }
});

// This tells the server to show your HTML/CSS/JS from the public folder
app.use(express.static(path.join(__dirname, '..', 'public')));

// Function to send logs to your Webpage
function sendLog(msg) {
    console.log(msg);
    io.emit('log-update', msg);
}

// =======================
// GEMINI AI
// =======================
const ai = new GoogleGenAI(process.env.GEMINI_API_KEY || "AIzaSyD1WO1AQy8sHzkI0iZn1w9VdFbtm1RY1ME");

// =======================
// DATABASE
// =======================
const db = new sqlite3.Database("./memory.db");
db.run(`CREATE TABLE IF NOT EXISTS memory(user TEXT, message TEXT)`);
db.run(`CREATE TABLE IF NOT EXISTS trust(user TEXT PRIMARY KEY, score INTEGER DEFAULT 0)`);

function saveMemory(user, msg) {
  db.run("INSERT INTO memory(user,message) VALUES(?,?)", [user, msg]);
}

function getMemory(user) {
  return new Promise(resolve => {
    db.all("SELECT message FROM memory WHERE user=? ORDER BY rowid DESC LIMIT 8", [user], (err, rows) => {
      if (err || !rows) return resolve([]);
      resolve(rows.map(r => r.message).reverse());
    });
  });
}

function addTrust(user, amount) {
  db.run(`INSERT INTO trust(user,score) VALUES(?,?) ON CONFLICT(user) DO UPDATE SET score = score + ?`, [user, amount, amount]);
}

// =======================
// BOT INITIALIZATION
// =======================
let bot;
const OWNER = "SharpPlayz52";
const ADMIN = "DavidxB3st";
const PASSWORD = "YourPassword123";

let guardMode = false;
let farmingMode = true;
let followInterval = null;

function createBot() {
    if (bot) bot.quit();

    bot = mineflayer.createBot({
      host: "bottlepixel.ddns.net",
      port: 12760,
      username: "ChatGen-V1Beta",
      version: "1.20.1",
      connectTimeout: 6000000000000000000000000000000000000000000000000000000000000000000000000000
    });

    bot.loadPlugin(pathfinder);
    bot.loadPlugin(autoeat);

    // =======================
    // LOGIN & SPAWN
    // =======================
    bot.on("spawn", () => {
      sendLog("ChatGen-V1Beta Online & Linked to Dashboard");

      const mcData = require('minecraft-data')(bot.version);
      const move = new Movements(bot, mcData);
      move.canDig = true;
      move.allow1by1towers = false;
      bot.pathfinder.setMovements(move);

      setTimeout(() => say(`/register ${PASSWORD}`), 3000);
      setTimeout(() => say(`/login ${PASSWORD}`), 6000);
      
      bot.autoEat.options = { priority: "foodPoints", startAt: 14 };
      startBrain();
    });

    bot.on("chat", (user, msg) => {
      if (!user || user === bot.username) return;
      sendLog(`[CHAT] ${user}: ${msg}`);
      askAI(user, msg);
    });

    bot.on("end", () => sendLog("Disconnected from Minecraft."));
    bot.on("kicked", r => sendLog("Kicked: " + r));
    bot.on("error", e => sendLog("Error: " + e.message));
}

// =======================
// CHAT & AI
// =======================
function say(msg) {
  if (!msg) return;
  bot.chat(String(msg).slice(0, 220));
}

async function askAI(user, msg) {
  try {
    if (executeCommand(user, msg)) return;
    saveMemory(user, msg);
    const mem = await getMemory(user);
    const prompt = `You are ChatGenAI Minecraft Bot. Be helpful and short. Memory: ${mem.join(" | ")} | User: ${user} | Message: ${msg}`;
    const result = await ai.getGenerativeModel({ model: "gemini-1.5-flash" }).generateContent(prompt);
    const response = result.response.text();
    say(response || "...");
    sendLog(`[AI RESPONSE]: ${response}`);
  } catch (err) {
    sendLog("Gemini Error: Check API Key");
  }
}

// =======================
// COMMANDS & LOGIC (UNCHANGED)
// =======================
function executeCommand(user, msg) {
  msg = msg.toLowerCase();
  if (user !== OWNER && user !== ADMIN) return false;
  if (msg === "guard on") { guardMode = true; say("Guard enabled"); return true; }
  if (msg === "guard off") { guardMode = false; say("Guard disabled"); return true; }
  if (msg === "farm on") { farmingMode = true; say("Farm enabled"); return true; }
  if (msg === "farm off") { farmingMode = false; say("Farm disabled"); return true; }
  if (msg === "follow me") { followPlayer(user); return true; }
  if (msg === "stop") { 
    bot.pathfinder.setGoal(null);
    if (followInterval) { clearInterval(followInterval); followInterval = null; }
    say("Stopped"); return true; 
  }
  return false;
}

function followPlayer(name) {
  if (followInterval) clearInterval(followInterval);
  say("Following " + name);
  followInterval = setInterval(() => {
    const target = bot.players[name]?.entity;
    if (!target) return;
    const distance = bot.entity.position.distanceTo(target.position);
    bot.pathfinder.setGoal(new goals.GoalFollow(target, 2), true);
    if (bot.entity.onGround && distance > 3) {
      bot.setControlState("jump", true);
      setTimeout(() => bot.setControlState("jump", false), 400);
    }
    if (distance > 30) say(`/tp ${bot.username} ${name}`);
  }, 1000);
}

function decide() {
  if (!bot.entity) return;
  if (bot.food < 14) bot.autoEat.enableAuto();
  if (bot.health < 6) { guardMode = false; runToSafeArea(); }
  if (farmingMode && bot.health > 10) gatherNearbyDrops();
}

function runToSafeArea() {
  const p = bot.entity.position;
  bot.pathfinder.setGoal(new goals.GoalNear(Math.floor(p.x + 6), Math.floor(p.y), Math.floor(p.z + 6), 1));
}

function gatherNearbyDrops() {
  if (!bot.entity) return;
  const drops = Object.values(bot.entities).filter(e => e.name === "item");
  if (drops.length === 0) return;
  const nearest = drops.sort((a, b) => bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position))[0];
  bot.pathfinder.setGoal(new goals.GoalNear(Math.floor(nearest.position.x), Math.floor(nearest.position.y), Math.floor(nearest.position.z), 1));
}

function combat() {
  const target = Object.values(bot.entities).find(e => e.type === "player" && e.username !== bot.username && e.username !== OWNER && e.username !== ADMIN);
  if (guardMode && target && bot.health > 6) { bot.lookAt(target.position); bot.attack(target); addTrust(target.username, -1); }
  const owner = bot.players[OWNER]?.entity;
  if (owner && target) { if (owner.position.distanceTo(target.position) < 4) bot.attack(target); }
}

function storeItems() {
  const items = bot.inventory.items();
  for (const item of items) {
    if (item.name.includes("stone") || item.name.includes("wood") || item.name.includes("food")) continue;
    bot.tossStack(item).catch(() => {});
  }
}

function startBrain() {
  setInterval(() => { decide(); combat(); storeItems(); }, 2500);
}

// =======================
// DASHBOARD WEB LINK
// =======================
io.on('connection', (socket) => {
    console.log('Dashboard connected via Socket.io');
    socket.on('bot-action', (action) => {
        if (action === 'start' || action === 'restart') {
            sendLog(`WEB-UI: Executing ${action}...`);
            createBot();
        }
    });
});

server.listen(3000, () => {
    console.log("LINK READY: http://localhost:3000");
});