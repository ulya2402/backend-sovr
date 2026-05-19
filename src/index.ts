export interface Env {
  sovr_db: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  ADMIN_ID: string;
  CMC_API_KEY: string;
}
export interface TelegramMessage { message_id: number; from?: { id: number; first_name: string; username?: string }; chat: { id: number; type: string }; text?: string; date: number; }
export interface TelegramCallbackQuery { id: string; from: { id: number; first_name: string }; message?: TelegramMessage; data: string; }
export interface TelegramUpdate { update_id: number; message?: TelegramMessage; callback_query?: TelegramCallbackQuery; }

async function sendTelegramMessage(env: Env, chatId: number, text: string, replyMarkup?: any) {
  const payload: any = { chat_id: chatId, text: text, parse_mode: "HTML" };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
}
async function editTelegramMessage(env: Env, chatId: number, messageId: number, text: string, replyMarkup?: any) {
  const payload: any = { chat_id: chatId, message_id: messageId, text: text, parse_mode: "HTML" };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/editMessageText`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
}
async function answerCallbackQuery(env: Env, callbackQueryId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: callbackQueryId, text: text }) });
}

function getTodayDate() {
  const d = new Date();
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

function isAdmin(env: Env, userId: string): boolean {
  const adminList = env.ADMIN_ID.split(',').map(id => id.trim());
  return adminList.includes(userId);
}

// --- TRIK MEMORI WIZARD BOT MENGGUNAKAN TABEL CACHE ---
async function getDraftState(env: Env, userId: string) {
  const row: any = await env.sovr_db.prepare("SELECT value FROM api_cache WHERE key = ?").bind(`draft_ai_${userId}`).first();
  return row ? JSON.parse(row.value) : null;
}
async function setDraftState(env: Env, userId: string, state: any) {
  await env.sovr_db.prepare("INSERT OR REPLACE INTO api_cache (key, value, updated_at) VALUES (?, ?, datetime('now'))").bind(`draft_ai_${userId}`, JSON.stringify(state)).run();
}
async function clearDraftState(env: Env, userId: string) {
  await env.sovr_db.prepare("DELETE FROM api_cache WHERE key = ?").bind(`draft_ai_${userId}`).run();
}


async function handleIncomingMessage(env: Env, message: TelegramMessage) {
  if (!message.text || !message.from) return;
  const chatId = message.chat.id;
  const text = message.text.trim();
  const user = message.from;
  const userId = user.id.toString();

  // 1. CEK WIZARD MODE: Apakah user sedang di tengah-tengah input Vault AI?
  const draft = await getDraftState(env, userId);
  if (draft) {
    if (text.startsWith("/")) {
      if (text === "/batal") {
        await clearDraftState(env, userId);
        return await sendTelegramMessage(env, chatId, "❌ Proses pengisian Vault dibatalkan.");
      } else {
        return await sendTelegramMessage(env, chatId, "⚠️ Anda sedang dalam proses pengisian data AI.\nSelesaikan dulu, atau ketik /batal untuk keluar.");
      }
    }

    if (draft.step === 'NAME') {
      draft.name = text; draft.step = 'URL';
      await setDraftState(env, userId, draft);
      return await sendTelegramMessage(env, chatId, "✅ <i>Tersimpan!</i>\n\nMasukkan <b>URL Website/App</b> tool tersebut:\n<i>(Contoh: https://midjourney.com)</i>");
    } 
    else if (draft.step === 'URL') {
      draft.url = text; draft.step = 'LOGO';
      await setDraftState(env, userId, draft);
      return await sendTelegramMessage(env, chatId, "✅ <i>Tersimpan!</i>\n\nMasukkan <b>Link URL Logo</b>:\n<i>(Cari gambar di Google, Copy Image Address)</i>");
    }
    else if (draft.step === 'LOGO') {
      draft.logo = text; draft.step = 'DESC';
      await setDraftState(env, userId, draft);
      return await sendTelegramMessage(env, chatId, "✅ <i>Tersimpan!</i>\n\nKetik <b>Deskripsi Singkat</b>:\n<i>(Maksimal 1-2 baris saja, akan tampil di kartu depan)</i>");
    }
    else if (draft.step === 'DESC') {
      draft.desc = text; draft.step = 'SUMMARY';
      await setDraftState(env, userId, draft);
      return await sendTelegramMessage(env, chatId, "✅ <i>Tersimpan!</i>\n\nKetik <b>Quick Summary (Highlight)</b>:\n<i>(Apa fitur unggulannya? Pisahkan dengan koma atau enter)</i>");
    }
    else if (draft.step === 'SUMMARY') {
      draft.summary = text; draft.step = 'PLATFORM';
      await setDraftState(env, userId, draft);
      return await sendTelegramMessage(env, chatId, "✅ <i>Tersimpan!</i>\n\nKetik <b>Platform</b> yang didukung:\n<i>(Contoh: Web App, iOS, Bot Telegram, Windows)</i>");
    }
    else if (draft.step === 'PLATFORM') {
      draft.platform = text; draft.step = 'CATEGORY';
      await setDraftState(env, userId, draft);
      
      const kb = { inline_keyboard: [
        [{text: "💬 Chat", callback_data: "aicat_Chat"}, {text: "🤖 Agent", callback_data: "aicat_Agent"}],
        [{text: "⚡ Productivity", callback_data: "aicat_Productivity"}, {text: "🖼️ Image", callback_data: "aicat_Image"}],
        [{text: "🎥 Video", callback_data: "aicat_Video"}, {text: "🛠️ Other", callback_data: "aicat_Other"}]
      ]};
      return await sendTelegramMessage(env, chatId, "✅ <i>Tersimpan!</i>\n\nSekarang klik <b>Kategori</b> di bawah ini:", kb);
    }
    return;
  }

  // 2. COMMAND REGULER
  if (text === "/start") {
    await sendTelegramMessage(env, chatId, `Halo <b>${user.first_name}</b>!\n\nPerintah Tersedia:\n📰 <b>/post</b> - Posting Berita\n🤖 <b>/ai</b> - Masukkan Tool AI ke Vault\n\n<i>Admin: /list, /hapus, /listai, /hapusai</i>`);
    return;
  }

  // Memicu Wizard Vault AI
  if (text === "/ai" || text === "/vault") {
    if (!isAdmin(env, userId)) return;
    await setDraftState(env, userId, { step: 'NAME' });
    return await sendTelegramMessage(env, chatId, "🤖 <b>TAMBAH TOOL AI KE VAULT</b>\n\nKetik /batal kapan saja untuk membatalkan proses.\n\nMasukkan <b>Nama Tool AI</b>:");
  }

  // Fitur List & Hapus Vault AI
  if (text === "/listai") {
    if (!isAdmin(env, userId)) return;
    try {
      const { results } = await env.sovr_db.prepare(`SELECT id, name, category FROM vault_tools ORDER BY id DESC LIMIT 5`).all();
      if (!results || results.length === 0) return await sendTelegramMessage(env, chatId, "Belum ada tool AI di Vault.");
      let msg = "🤖 <b>5 Tool AI Terakhir (Vault):</b>\n\n";
      results.forEach((a: any) => { msg += `🆔 <code>/hapusai ${a.id}</code>\n📌 [${a.category}] ${a.name}\n\n`; });
      await sendTelegramMessage(env, chatId, msg);
    } catch(e: any) { await sendTelegramMessage(env, chatId, `Error listai: ${e.message}`); }
    return;
  }

  if (text.startsWith("/hapusai")) {
    if (!isAdmin(env, userId)) return;
    try {
      const id = text.split(" ")[1];
      if (!id) return await sendTelegramMessage(env, chatId, "Format salah. Contoh: <code>/hapusai 3</code>");
      const check = await env.sovr_db.prepare(`SELECT name FROM vault_tools WHERE id = ?`).bind(id).first();
      if (!check) return await sendTelegramMessage(env, chatId, `Tool dengan ID ${id} tidak ditemukan.`);
      
      await env.sovr_db.prepare(`DELETE FROM vault_tools WHERE id = ?`).bind(id).run();
      await sendTelegramMessage(env, chatId, `✅ <b>Sukses Dihapus!</b>\nTool: <i>${check.name}</i> telah dihapus dari Vault.`);
    } catch(e: any) { await sendTelegramMessage(env, chatId, `Error hapusai: ${e.message}`); }
    return;
  }

  // COMMAND LAMA: Fitur Berita Tetap Aman
  if (text === "/list") {
    if (!isAdmin(env, userId)) return;
    try {
      const { results } = await env.sovr_db.prepare(`SELECT id, title, tag FROM articles ORDER BY id DESC LIMIT 5`).all();
      if (!results || results.length === 0) return await sendTelegramMessage(env, chatId, "Belum ada artikel di database.");
      let msg = "📝 <b>5 Artikel Terakhir:</b>\n\n";
      results.forEach((a: any) => { msg += `🆔 <code>/hapus ${a.id}</code>\n📌 [${a.tag}] ${a.title}\n\n`; });
      await sendTelegramMessage(env, chatId, msg);
    } catch(e: any) { await sendTelegramMessage(env, chatId, `Error list: ${e.message}`); }
    return;
  }

  if (text.startsWith("/hapus ")) {
    if (!isAdmin(env, userId)) return;
    try {
      const id = text.split(" ")[1];
      if (!id) return await sendTelegramMessage(env, chatId, "Format salah. Contoh: <code>/hapus 3</code>");
      const check = await env.sovr_db.prepare(`SELECT title FROM articles WHERE id = ?`).bind(id).first();
      if (!check) return await sendTelegramMessage(env, chatId, `Artikel dengan ID ${id} tidak ditemukan.`);
      
      await env.sovr_db.prepare(`DELETE FROM articles WHERE id = ?`).bind(id).run();
      await sendTelegramMessage(env, chatId, `✅ <b>Sukses Dihapus!</b>\nBerita: <i>${check.title}</i> telah dihapus.`);
    } catch(e: any) { await sendTelegramMessage(env, chatId, `Error hapus: ${e.message}`); }
    return;
  }

  if (text.startsWith("/post")) {
    if (!isAdmin(env, userId)) return await sendTelegramMessage(env, chatId, "⛔ Khusus Tim Redaksi SOVR.");
    try {
      const lines = text.split('\n');
      let judul = "", tanggal = "", penulis = "", kategori = "", isi = "", sumber = "";
      
      lines.forEach(line => {
        const l = line.toLowerCase();
        if (l.startsWith("judul")) judul = line.substring(line.indexOf(":") + 1).trim();
        else if (l.startsWith("tanggal")) tanggal = line.substring(line.indexOf(":") + 1).trim();
        else if (l.startsWith("penulis")) penulis = line.substring(line.indexOf(":") + 1).trim();
        else if (l.startsWith("kategori")) kategori = line.substring(line.indexOf(":") + 1).trim();
        else if (l.startsWith("isi artikel")) isi = line.substring(line.indexOf(":") + 1).trim();
        else if (l.startsWith("sumber")) sumber = line.substring(line.indexOf(":") + 1).trim();
      });

      if (!judul || !tanggal || !penulis || !kategori || !isi) {
        return await sendTelegramMessage(env, chatId, "❌ Format salah. Pastikan format:\n\n/post\nJudul : [Teks]\nTanggal : [NOW]\nPenulis : [Nama]\nKategori : [AI/Kripto/Market/DeFi]\nSumber : [Link/Opsional]\nIsi Artikel : [Teks]");
      }
      
      if (tanggal.toUpperCase() === "NOW") tanggal = getTodayDate();

      const catSlug = kategori.toLowerCase();
      let icon = "ri-newspaper-line", tagBaru = "Market", slugDB = "market";
      if (catSlug.includes("ai")) { icon = "ri-sparkling-2-line"; tagBaru = "AI"; slugDB = "ai"; }
      else if (catSlug.includes("kripto")) { icon = "ri-coin-line"; tagBaru = "Kripto"; slugDB = "kripto"; }
      else if (catSlug.includes("market")) { icon = "ri-line-chart-line"; tagBaru = "Market"; slugDB = "market"; }
      else if (catSlug.includes("defi")) { icon = "ri-swap-line"; tagBaru = "DeFi"; slugDB = "defi"; }

      const sourceUrl = sumber && sumber.startsWith("http") ? sumber : "#";
      let sourceName = "SOVR Internal";
      if (sourceUrl !== "#") {
        try { sourceName = new URL(sourceUrl).hostname.replace('www.', ''); } catch(e) { sourceName = "Eksternal"; }
      }

      const insertQuery = `INSERT INTO articles (tag, category, title, body, author, source_name, source_url, source_logo, published_date, status, featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0) RETURNING id`;
      
      const result = await env.sovr_db.prepare(insertQuery).bind(tagBaru, slugDB, judul, isi, penulis, sourceName, sourceUrl, icon, tanggal).first();
      
      const keyboard = { inline_keyboard: [[{ text: "✅ Posting Biasa", callback_data: `pub_norm_${result?.id}` }], [{ text: "🌟 Pilihan Editor", callback_data: `pub_edit_${result?.id}` }], [{ text: "❌ Batal", callback_data: `cancel_${result?.id}` }]]};
      await sendTelegramMessage(env, chatId, `📝 <b>DRAFT BERITA:</b> ${judul}\n🔗 <b>Sumber:</b> ${sourceName}`, keyboard);
    } catch (e: any) { await sendTelegramMessage(env, chatId, `Error: ${e.message}`); }
    return;
  }
}

async function handleCallbackQuery(env: Env, callbackQuery: TelegramCallbackQuery) {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message?.chat.id;
  const messageId = callbackQuery.message?.message_id;
  const userId = callbackQuery.from.id.toString();
  if (!chatId || !messageId) return;
  
  if (!isAdmin(env, userId)) return await answerCallbackQuery(env, callbackQuery.id, "Anda bukan Admin!");

  // --- LOGIKA TOMBOL WIZARD VAULT AI ---
  const draft = await getDraftState(env, userId);
  if (data.startsWith("aicat_")) {
    if (!draft || draft.step !== 'CATEGORY') return await answerCallbackQuery(env, callbackQuery.id, "Sesi kadaluarsa. Ketik /ai lagi.");
    
    draft.category = data.split('_')[1];
    draft.step = 'PRICING';
    await setDraftState(env, userId, draft);
    
    const kb = { inline_keyboard: [
      [{text: "🆓 Free", callback_data: "aipri_Free"}, {text: "💎 Freemium", callback_data: "aipri_Freemium"}, {text: "💰 Paid", callback_data: "aipri_Paid"}]
    ]};
    await editTelegramMessage(env, chatId, messageId, `✅ <b>Kategori Terpilih:</b> ${draft.category}\n\nTerakhir, klik skema <b>Harga (Pricing)</b>:`, kb);
    return await answerCallbackQuery(env, callbackQuery.id, "Kategori disimpan");
  } 
  
  else if (data.startsWith("aipri_")) {
    if (!draft || draft.step !== 'PRICING') return await answerCallbackQuery(env, callbackQuery.id, "Sesi kadaluarsa. Ketik /ai lagi.");
    
    const pricing = data.split('_')[1];
    try {
      const q = `INSERT INTO vault_tools (name, url, logo, description, summary, platform, category, pricing) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      await env.sovr_db.prepare(q).bind(draft.name, draft.url, draft.logo, draft.desc, draft.summary, draft.platform, draft.category, pricing).run();

      await clearDraftState(env, userId);
      await editTelegramMessage(env, chatId, messageId, `🎉 <b>SUKSES!</b>\n\nTool <b>${draft.name}</b> berhasil diluncurkan ke Vault SOVR! 🚀`);
    } catch(e:any) {
      await editTelegramMessage(env, chatId, messageId, `Gagal menyimpan database: ${e.message}`);
    }
    return await answerCallbackQuery(env, callbackQuery.id, "Disimpan ke Database!");
  }

  // --- LOGIKA TOMBOL PUBLISH BERITA (LAMA) ---
  try {
    const action = data.slice(0, 8); 
    const articleId = data.split('_')[2];
    if (action === "cancel__") {
      await env.sovr_db.prepare(`DELETE FROM articles WHERE id = ?`).bind(articleId).run();
      await editTelegramMessage(env, chatId, messageId, "❌ Draft berita dihapus.");
    } else if (action === "pub_norm") {
      await env.sovr_db.prepare(`UPDATE articles SET status = 'published', featured = 0 WHERE id = ?`).bind(articleId).run();
      await editTelegramMessage(env, chatId, messageId, "✅ Terbit sebagai Berita Biasa.");
    } else if (action === "pub_edit") {
      await env.sovr_db.prepare(`UPDATE articles SET status = 'published', featured = 1 WHERE id = ?`).bind(articleId).run();
      await editTelegramMessage(env, chatId, messageId, "🌟 Terbit sebagai Pilihan Editor.");
    }
    await answerCallbackQuery(env, callbackQuery.id, "Berhasil!");
  } catch (e: any) { await editTelegramMessage(env, chatId, messageId, `[Error] ${e.message}`); }
}

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    // API Berita
    if (url.pathname === "/api/articles" && request.method === "GET") {
      const { results } = await env.sovr_db.prepare(`SELECT * FROM articles WHERE status = 'published' ORDER BY id DESC`).all();
      return new Response(JSON.stringify(results), { status: 200, headers: corsHeaders });
    }

    // API VAULT BARU 🚀
    if (url.pathname === "/api/vault" && request.method === "GET") {
      const { results } = await env.sovr_db.prepare(`SELECT * FROM vault_tools ORDER BY id DESC`).all();
      return new Response(JSON.stringify(results), { status: 200, headers: corsHeaders });
    }

    // API Ticker Crypto
    if (url.pathname === "/api/ticker" && request.method === "GET") {
      try {
        const cache: any = await env.sovr_db.prepare("SELECT value FROM api_cache WHERE key = 'ticker_data' AND updated_at > datetime('now', '-15 minutes')").first();
        if (cache?.value) return new Response(cache.value, { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const cmcResponse = await fetch("https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=BTC,ETH,SOL,BNB", { headers: { "X-CMC_PRO_API_KEY": env.CMC_API_KEY, "Accept": "application/json" }});
        const cmcData: any = await cmcResponse.json();
        const fngResponse = await fetch("https://api.alternative.me/fng/");
        const fngData: any = await fngResponse.json();
        
        const fngValue = fngData?.data?.[0]?.value || "50";
        const fngClass = fngData?.data?.[0]?.value_classification || "Neutral";
        const coins = ["BTC", "ETH", "SOL", "BNB"];
        const mappedCoins = coins.map(coin => {
          const info = cmcData.data[coin];
          if (!info) return null;
          const price = info.quote.USD.price;
          const change24h = info.quote.USD.percent_change_24h;
          return {
            symbol: coin,
            pair: `${coin}/USDT`,
            price: price >= 1000 ? price.toLocaleString('en-US', {maximumFractionDigits: 0}) : price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
            change: (change24h > 0 ? "+" : "") + change24h.toFixed(2) + "%",
            isUp: change24h >= 0
          };
        }).filter(Boolean);

        const stringified = JSON.stringify({ coins: mappedCoins, fng: { value: fngValue, classification: fngClass } });
        await env.sovr_db.prepare("INSERT OR REPLACE INTO api_cache (key, value, updated_at) VALUES ('ticker_data', ?, datetime('now'))").bind(stringified).run();
        return new Response(stringified, { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (error) {
        const fallback = { coins: [{ symbol: "BTC", pair: "BTC/USDT", price: "76,000", change: "0.0%", isUp: true }], fng: { value: "50", classification: "Neutral" } };
        return new Response(JSON.stringify(fallback), { status: 200, headers: corsHeaders });
      }
    }

    if (url.pathname === "/" && request.method === "POST") {
      try {
        const update: TelegramUpdate = await request.json();
        if (update.message) ctx.waitUntil(handleIncomingMessage(env, update.message));
        else if (update.callback_query) ctx.waitUntil(handleCallbackQuery(env, update.callback_query));
      } catch (e) {}
      return new Response("OK", { status: 200 });
    }
    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};