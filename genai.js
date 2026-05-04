const { GoogleGenAI } = require("@google/genai");

const genAI = new GoogleGenAI(process.env.GEMINI_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3.0-flash" });

async function getAIResponse(username, message) {
    try {
        const prompt = `You are 'CraftGenAI', an AI player on a Lifesteal SMP. Player ${username} said: ${message}. Respond shortly.`;
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (err) {
        return "System lag... processing later.";
    }
}

module.exports = { getAIResponse };
