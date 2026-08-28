// index.js - Autonomous Agent Server (OpenRouter)
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// 1. Load environment variables
dotenv.config();

// 2. Buat aplikasi Express
const app = express();
const PORT = process.env.PORT || 3000;

// 3. Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

console.log('🤖 Autonomous Agent Server Starting with OpenRouter...');

// ================================================
// Konfigurasi OpenRouter
// ================================================
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Daftar model gratis di OpenRouter:
// - meta-llama/llama-3.2-3b-instruct:free
// - mistralai/mistral-7b-instruct:free
// - google/gemini-2.0-flash-lite-preview-02-05:free
// - microsoft/phi-3-mini-128k-instruct:free

// Model yang akan digunakan (ganti sesuai kebutuhan)
const MODEL = 'openrouter/free';

// ================================================
// ENDPOINT 1: Cek server (Health Check)
// ================================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server autonomous agent berjalan dengan OpenRouter!',
    model: MODEL,
    time: new Date().toISOString()
  });
});

// ================================================
// ENDPOINT 2: Agent utama
// ================================================
app.post('/api/agent', async (req, res) => {
  try {
    // Ambil tugas dari user
    const { task } = req.body;
    
    if (!task) {
      return res.status(400).json({
        error: 'Tolong beri tahu tugas apa yang harus dikerjakan'
      });
    }

    console.log(`📝 Menerima tugas: ${task}`);
    console.log(`🤖 Menggunakan model: ${MODEL}`);

    // System prompt - ini yang membuat AI jadi "Agent"
    const systemPrompt = `
      Kamu adalah Autonomous Agent yang cerdas dan membantu.

      TUGAS KAMU:
      Selesaikan permintaan user dengan sebaik mungkin.

      ATURAN:
      1. Pahami dulu apa yang diminta user
      2. Kerjakan dengan teliti dan terstruktur
      3. Berikan hasil yang jelas dan mudah dipahami
      4. Jika tugas berulang, kerjakan dengan konsisten

      INGAT: Kamu BUKAN chatbot biasa!
      Kamu adalah AGENT yang bertindak dan menyelesaikan tugas!
    `;

    // Kirim ke OpenRouter
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000', // Required by OpenRouter
        'X-Title': 'Autonomous Agent App' // Optional
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: task }
        ],
        temperature: 0.7,
        max_tokens: 1024,
      })
    });

    // Cek response
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenRouter API Error:', response.status, errorText);
      return res.status(response.status).json({
        error: 'OpenRouter API error',
        status: response.status,
        details: errorText
      });
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content || 'Maaf, tidak ada respons';

    console.log(`✅ Tugas selesai!`);

    // Kirim balik
    res.json({
      success: true,
      task: task,
      result: result,
      model: MODEL,
      provider: 'OpenRouter'
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      error: 'Terjadi kesalahan',
      details: error.message
    });
  }
});

// ================================================
// ENDPOINT 3: Agent dengan memory (chat)
// ================================================
const chatHistory = {};

app.post('/api/agent/chat', async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Pesan tidak boleh kosong' });
    }

    const session = sessionId || `session_${Date.now()}`;
    
    if (!chatHistory[session]) {
      chatHistory[session] = [
        { role: 'system', content: 'Kamu adalah Autonomous Agent yang membantu. Ingat percakapan sebelumnya.' }
      ];
    }

    chatHistory[session].push({ role: 'user', content: message });

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: chatHistory[session],
        temperature: 0.7,
        max_tokens: 1024,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content || 'Maaf, tidak ada respons';
    chatHistory[session].push({ role: 'assistant', content: result });

    res.json({
      success: true,
      sessionId: session,
      response: result
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ================================================
// ENDPOINT 4: Lihat daftar model yang tersedia
// ================================================
app.get('/api/models', async (req, res) => {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`
      }
    });
    
    const data = await response.json();
    const freeModels = data.data
      ?.filter(m => m.pricing?.prompt === '0' && m.pricing?.completion === '0')
      .map(m => m.id) || [];
    
    res.json({
      total: data.data?.length || 0,
      freeModels: freeModels,
      allModels: data.data?.slice(0, 10) || [] // 10 model pertama
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ================================================
// Jalankan server
// ================================================
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════╗
║    🤖 Autonomous Agent Server (OpenRouter)    ║
║                                               ║
║    Running on: http://localhost:${PORT}       ║
║                                               ║
║    Model: ${MODEL}                            ║
║                                               ║
║    Endpoints:                                 ║
║    POST /api/agent  (kirim tugas)            ║
║    POST /api/agent/chat (chat dengan memory) ║
║    GET  /api/health (cek status)             ║
║    GET  /api/models (lihat model gratis)     ║
╚════════════════════════════════════════════════╝
  `);
});