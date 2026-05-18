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
async function editTelegramMessage(env: Env, chatId: number, messageId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/editMessageText`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: text, parse_mode: "HTML" }) });
}
async function answerCallbackQuery(env: Env, callbackQueryId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: callbackQueryId, text: text }) });
}

function getTodayDate() {
  const d = new Date();
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

function isAdmin(env: Env, userId: string): boolean {
  // Memecah string "id1,id2,id3" menjadi array dan mengecek apakah userId ada di dalamnya
  const adminList = env.ADMIN_ID.split(',').map(id => id.trim());
  return adminList.includes(userId);
}


async function handleIncomingMessage(env: Env, message: TelegramMessage) {
  if (!message.text || !message.from) return;
  const chatId = message.chat.id;
  const text = message.text.trim();
  const user = message.from;
  const userId = user.id.toString();

  if (text === "/start") {
    await sendTelegramMessage(env, chatId, `Halo <b>${user.first_name}</b>!\nKetik /terbaru untuk membaca insight.\nAdmin Command: /list & /hapus [id]`);
    return;
  }

  if (text === "/list") {
    if (!isAdmin(env, userId)) return;
    try {
      const { results } = await env.sovr_db.prepare(`SELECT id, title, tag FROM articles ORDER BY id DESC LIMIT 5`).all();
      if (!results || results.length === 0) return await sendTelegramMessage(env, chatId, "Belum ada artikel di database.");
      let msg = "📝 <b>5 Artikel Terakhir:</b>\n\n";
      results.forEach((a: any) => { msg += `🆔 <code>/hapus ${a.id}</code>\n📌 [${a.tag}] ${a.title}\n\n`; });
      msg += "<i>*Klik perintah /hapus di atas untuk menyalin otomatis</i>";
      await sendTelegramMessage(env, chatId, msg);
    } catch(e: any) { await sendTelegramMessage(env, chatId, `Error list: ${e.message}`); }
    return;
  }

  if (text.startsWith("/hapus")) {
    if (!isAdmin(env, userId)) return;
    try {
      const id = text.split(" ")[1];
      if (!id) return await sendTelegramMessage(env, chatId, "Format salah. Contoh: <code>/hapus 3</code>");
      const check = await env.sovr_db.prepare(`SELECT title FROM articles WHERE id = ?`).bind(id).first();
      if (!check) return await sendTelegramMessage(env, chatId, `Artikel dengan ID ${id} tidak ditemukan.`);
      
      await env.sovr_db.prepare(`DELETE FROM articles WHERE id = ?`).bind(id).run();
      await sendTelegramMessage(env, chatId, `✅ <b>Sukses Dihapus!</b>\nArtikel ID: ${id}\nJudul: <i>${check.title}</i> telah dihapus dari website.`);
    } catch(e: any) { await sendTelegramMessage(env, chatId, `Error hapus: ${e.message}`); }
    return;
  }

  if (text.startsWith("/post")) {
    if (!isAdmin(env, userId)) return await sendTelegramMessage(env, chatId, "⛔ Khusus Tim Redaksi SOVR.");
    try {
      const lines = text.split('\n');
      // PERUBAHAN: Menambahkan variabel 'sumber'
      let judul = "", tanggal = "", penulis = "", kategori = "", isi = "", sumber = "";
      
      lines.forEach(line => {
        const l = line.toLowerCase();
        if (l.startsWith("judul")) judul = line.substring(line.indexOf(":") + 1).trim();
        else if (l.startsWith("tanggal")) tanggal = line.substring(line.indexOf(":") + 1).trim();
        else if (l.startsWith("penulis")) penulis = line.substring(line.indexOf(":") + 1).trim();
        else if (l.startsWith("kategori")) kategori = line.substring(line.indexOf(":") + 1).trim();
        else if (l.startsWith("isi artikel")) isi = line.substring(line.indexOf(":") + 1).trim();
        // PERUBAHAN: Membaca baris "Sumber :"
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

      // PERUBAHAN: Logika untuk memproses Sumber (Jika kosong, kembali ke SOVR Internal)
      const sourceUrl = sumber && sumber.startsWith("http") ? sumber : "#";
      let sourceName = "SOVR Internal";
      if (sourceUrl !== "#") {
        try { sourceName = new URL(sourceUrl).hostname.replace('www.', ''); } catch(e) { sourceName = "Eksternal"; }
      }

      const insertQuery = `INSERT INTO articles (tag, category, title, body, author, source_name, source_url, source_logo, published_date, status, featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0) RETURNING id`;
      
      // PERUBAHAN: Memasukkan sourceName dan sourceUrl ke Database
      const result = await env.sovr_db.prepare(insertQuery).bind(tagBaru, slugDB, judul, isi, penulis, sourceName, sourceUrl, icon, tanggal).first();
      
      const keyboard = { inline_keyboard: [[{ text: "✅ Posting Biasa", callback_data: `pub_norm_${result?.id}` }], [{ text: "🌟 Pilihan Editor", callback_data: `pub_edit_${result?.id}` }], [{ text: "❌ Batal", callback_data: `cancel_${result?.id}` }]]};
      await sendTelegramMessage(env, chatId, `📝 <b>DRAFT:</b> ${judul}\n🔗 <b>Sumber:</b> ${sourceName}`, keyboard);
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
  
  // --- CEK ADMIN MULTIPEL UNTUK TOMBOL INLINE ---
  if (!isAdmin(env, userId)) return await answerCallbackQuery(env, callbackQuery.id, "Anda bukan Admin!");

  try {
    const action = data.slice(0, 8); 
    const articleId = data.split('_')[2];
    if (action === "cancel__") {
      await env.sovr_db.prepare(`DELETE FROM articles WHERE id = ?`).bind(articleId).run();
      await editTelegramMessage(env, chatId, messageId, "❌ Draft dihapus.");
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

    if (url.pathname === "/api/articles" && request.method === "GET") {
      const { results } = await env.sovr_db.prepare(`SELECT * FROM articles WHERE status = 'published' ORDER BY id DESC`).all();
      return new Response(JSON.stringify(results), { status: 200, headers: corsHeaders });
    }

    // --- LOGIKA TICKER + CACHE 15 MENIT + FEAR & GREED ---
    if (url.pathname === "/api/ticker" && request.method === "GET") {
      try {
        // 1. Cek apakah ada cache di database yang umurnya kurang dari 15 menit
        const cache: any = await env.sovr_db.prepare("SELECT value FROM api_cache WHERE key = 'ticker_data' AND updated_at > datetime('now', '-15 minutes')").first();
        if (cache?.value) {
          return new Response(cache.value, { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // 2. Jika cache kedaluwarsa, ambil data baru dari CoinMarketCap
        const cmcResponse = await fetch("https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=BTC,ETH,SOL,BNB", {
          headers: { "X-CMC_PRO_API_KEY": env.CMC_API_KEY, "Accept": "application/json" }
        });
        const cmcData: any = await cmcResponse.json();

        // 3. Ambil data Fear & Greed Index
        const fngResponse = await fetch("https://api.alternative.me/fng/");
        const fngData: any = await fngResponse.json();
        const fngValue = fngData?.data?.[0]?.value || "50";
        const fngClass = fngData?.data?.[0]?.value_classification || "Neutral";

        // Merapikan data koin
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

        // Gabungkan seluruh data menjadi satu paket raksasa
        const finalPayload = {
          coins: mappedCoins,
          fng: { value: fngValue, classification: fngClass }
        };

        const stringified = JSON.stringify(finalPayload);

        // 4. Simpan paket data baru ke dalam database cache
        await env.sovr_db.prepare("INSERT OR REPLACE INTO api_cache (key, value, updated_at) VALUES ('ticker_data', ?, datetime('now'))").bind(stringified).run();

        return new Response(stringified, { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (error) {
        // Fallback jika API down
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