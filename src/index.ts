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

// --- AWAL PERUBAHAN ---

async function answerCallbackQuery(env: Env, callbackQueryId: string, text: string, showAlert: boolean = false) {
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, { 
    method: "POST", 
    headers: { "Content-Type": "application/json" }, 
    body: JSON.stringify({ callback_query_id: callbackQueryId, text: text, show_alert: showAlert }) 
  });
}

async function deleteTelegramMessage(env: Env, chatId: number, messageId: number) {
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/deleteMessage`, { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }) 
    });
  } catch (error) {
    console.error("Failed to delete telegram message");
  }
}

function getTodayDate() {
  const d = new Date();
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

function isAdmin(env: Env, userId: string): boolean {
  const adminList = env.ADMIN_ID.split(',').map(id => id.trim());
  return adminList.includes(userId);
}

// --- AWAL PERUBAHAN UTILITY ---
function optimizeImage(url: string): string {
  if (!url || url === "#" || !url.startsWith("http")) return url;
  if (url.includes("wsrv.nl")) return url;
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&output=webp&q=75`;
}
// --- BATAS PERUBAHAN UTILITY ---

export interface TelegramState {
  menu: string;
  action: string;
  draft: any;
  waitingFor: string | null;
  lastMessageId: number | null;
}

async function getUserState(env: Env, userId: string): Promise<TelegramState | null> {
  const row: any = await env.sovr_db.prepare("SELECT value FROM api_cache WHERE key = ?").bind(`state_${userId}`).first();
  return row ? JSON.parse(row.value) : null;
}

async function setUserState(env: Env, userId: string, state: TelegramState) {
  await env.sovr_db.prepare("INSERT OR REPLACE INTO api_cache (key, value, updated_at) VALUES (?, ?, datetime('now'))").bind(`state_${userId}`, JSON.stringify(state)).run();
}

async function clearUserState(env: Env, userId: string) {
  await env.sovr_db.prepare("DELETE FROM api_cache WHERE key = ?").bind(`state_${userId}`).run();
}

const mainKeyboard = {
  inline_keyboard: [
    [{ text: "📱 Manajemen Feed", callback_data: "menu_feed" }],
    [{ text: "🔒 Manajemen Vault", callback_data: "menu_vault" }],
    [{ text: "🔭 Manajemen Perspectives", callback_data: "menu_perspectives" }],
    [{ text: "⭐ Pilihan Editor", callback_data: "menu_editor" }]
  ]
};

// --- AWAL PERUBAHAN ---
const feedKeyboard = {
  inline_keyboard: [
    [{ text: "📝 Post Feed", callback_data: "f_post" }, { text: "📋 List Feed", callback_data: "f_list" }],
    [{ text: "✏️ Edit Feed", callback_data: "f_edit" }, { text: "❌ Delete Feed", callback_data: "f_delete" }],
    [{ text: "⬅️ Kembali ke Menu Utama", callback_data: "menu_main" }]
  ]
};

function renderFeedDraft(draft: any) {
  const text = `📝 <b>DRAFT ARTIKEL BARU</b>\n\n` +
    `🎫 <b>Judul:</b> ${draft.title || '<i>(Belum diisi)</i>'}\n` +
    `📅 <b>Tanggal:</b> ${draft.date || '<i>(Belum diisi)</i>'}\n` +
    `✍️ <b>Penulis:</b> ${draft.author || '<i>(Belum diisi)</i>'}\n` +
    `🏷️ <b>Kategori:</b> ${draft.category || '<i>(Belum diisi)</i>'}\n` +
    `🌐 <b>Sumber:</b> ${draft.source || '<i>(Belum diisi)</i>'}\n` +
    `📄 <b>Isi Artikel:</b> ${draft.body ? draft.body.substring(0, 60) + '...' : '<i>(Belum diisi)</i>'}`;

  const keyboard = {
    inline_keyboard: [
      [{ text: "🎫 Judul", callback_data: "f_input_title" }, { text: "📅 Tanggal", callback_data: "f_input_date" }, { text: "✍️ Penulis", callback_data: "f_input_author" }],
      [{ text: "🏷️ Kategori", callback_data: "f_input_category" }, { text: "🌐 Sumber", callback_data: "f_input_source" }, { text: "📄 Isi Artikel", callback_data: "f_input_body" }],
      [{ text: "⬅️ Kembali", callback_data: "menu_feed" }, { text: "💾 Kirim/Post", callback_data: "f_submit" }]
    ]
  };
  return { text, keyboard };
}

const vaultKeyboard = {
  inline_keyboard: [
    [{ text: "📝 Tambah Tool", callback_data: "v_post" }, { text: "📋 List Tool", callback_data: "v_list" }],
    [{ text: "✏️ Edit Tool", callback_data: "v_edit" }, { text: "❌ Delete Tool", callback_data: "v_delete" }],
    [{ text: "⬅️ Kembali ke Menu Utama", callback_data: "menu_main" }]
  ]
};

function renderVaultDraft(draft: any) {
  const text = `🔒 <b>DRAFT VAULT TOOL</b>\n\n` +
    `🏷️ <b>Nama:</b> ${draft.name || '<i>(Belum diisi)</i>'}\n` +
    `🖼️ <b>Logo URL:</b> ${draft.logo ? '✅ Diisi' : '<i>(Belum diisi)</i>'}\n` +
    `📝 <b>Deskripsi:</b> ${draft.description || '<i>(Belum diisi)</i>'}\n` +
    `📂 <b>Kategori:</b> ${draft.category || '<i>(Belum diisi)</i>'}\n` +
    `💰 <b>Pricing:</b> ${draft.pricing || '<i>(Belum diisi)</i>'}\n` +
    `💻 <b>Platform:</b> ${draft.platform || '<i>(Belum diisi)</i>'}\n` +
    `🔗 <b>URL:</b> ${draft.url || '<i>(Belum diisi)</i>'}\n` +
    `⚡ <b>Summary:</b> ${draft.summary ? draft.summary.substring(0, 30) + '...' : '<i>(Belum diisi)</i>'}`;

  const keyboard = {
    inline_keyboard: [
      [{ text: "🏷️ Nama", callback_data: "v_input_name" }, { text: "🖼️ Logo", callback_data: "v_input_logo" }, { text: "📝 Deskripsi", callback_data: "v_input_description" }],
      [{ text: "📂 Kategori", callback_data: "v_input_category" }, { text: "💰 Pricing", callback_data: "v_input_pricing" }, { text: "💻 Platform", callback_data: "v_input_platform" }],
      [{ text: "🔗 URL", callback_data: "v_input_url" }, { text: "⚡ Summary", callback_data: "v_input_summary" }],
      [{ text: "⬅️ Kembali", callback_data: "menu_vault" }, { text: "💾 Simpan Tool", callback_data: "v_submit" }]
    ]
  };
  return { text, keyboard };
}
const perspectivesKeyboard = {
  inline_keyboard: [
    [{ text: "📝 Post Perspektif", callback_data: "p_post" }, { text: "📋 List Perspektif", callback_data: "p_list" }],
    [{ text: "✏️ Edit Perspektif", callback_data: "p_edit" }, { text: "❌ Delete Perspektif", callback_data: "p_delete" }],
    [{ text: "⬅️ Kembali ke Menu Utama", callback_data: "menu_main" }]
  ]
};

function renderPerspectivesDraft(draft: any) {
  const text = `🔭 <b>DRAFT PERSPECTIVES EDITORIAL</b>\n\n` +
    `🎫 <b>Judul:</b> ${draft.title || '<i>(Belum diisi)</i>'}\n` +
    `📅 <b>Tanggal:</b> ${draft.date || '<i>(Belum diisi)</i>'}\n` +
    `✍️ <b>Penulis:</b> ${draft.author || '<i>(Belum diisi)</i>'}\n` +
    `🏷️ <b>Kategori:</b> ${draft.category || '<i>(Belum diisi)</i>'}\n` +
    `🖼️ <b>Link Gambar:</b> ${draft.image ? '✅ Gambar Tersemat' : '<i>(Belum diisi)</i>'}\n` +
    `📄 <b>Isi Artikel:</b> ${draft.body ? '✅ Diisi (' + draft.body.length + ' karakter)' : '<i>(Belum diisi)</i>'}`;

  const keyboard = {
    inline_keyboard: [
      [{ text: "🎫 Judul", callback_data: "p_input_title" }, { text: "📅 Tanggal", callback_data: "p_input_date" }, { text: "✍️ Penulis", callback_data: "p_input_author" }],
      [{ text: "🏷️ Kategori", callback_data: "p_input_category" }, { text: "🖼️ Link Gambar", callback_data: "p_input_image" }, { text: "📄 Isi Artikel", callback_data: "p_input_body" }],
      [{ text: "⬅️ Kembali", callback_data: "menu_perspectives" }, { text: "💾 Kirim/Post", callback_data: "p_submit" }]
    ]
  };
  return { text, keyboard };
}
// --- BATAS PERUBAHAN ---

async function handleIncomingMessage(env: Env, message: TelegramMessage) {
  if (!message.text || !message.from) return;
  const chatId = message.chat.id;
  const text = message.text.trim();
  const userId = message.from.id.toString();

  if (!isAdmin(env, userId)) return;

  if (text === "/start") {
    await clearUserState(env, userId);
    await sendTelegramMessage(env, chatId, "👋 <b>Selamat Datang di SOVR Admin Panel</b>\n\nSilakan pilih menu di bawah ini:", mainKeyboard);
    return;
  }

  const state = await getUserState(env, userId);
  
  // --- AWAL PERUBAHAN 2 ---
  // --- AWAL PERUBAHAN TAHAP 3 ---
  if (state && state.waitingFor && state.lastMessageId) {
    await deleteTelegramMessage(env, chatId, message.message_id);
    
    state.draft[state.waitingFor] = text;
    state.waitingFor = null;
    await setUserState(env, userId, state);

    if (state.menu === "VAULT") {
      const view = renderVaultDraft(state.draft);
      await editTelegramMessage(env, chatId, state.lastMessageId, `✅ <i>Data diperbarui!</i>\n\n${view.text}`, view.keyboard);
    } else if (state.menu === "PERSPECTIVES") {
      const view = renderPerspectivesDraft(state.draft);
      await editTelegramMessage(env, chatId, state.lastMessageId, `✅ <i>Data diperbarui!</i>\n\n${view.text}`, view.keyboard);
    } else {
      const view = renderFeedDraft(state.draft);
      await editTelegramMessage(env, chatId, state.lastMessageId, `✅ <i>Data diperbarui!</i>\n\n${view.text}`, view.keyboard);
    }
    return;
  }
// --- BATAS PERUBAHAN TAHAP 3 ---
// --- BATAS PERUBAHAN 2 ---

}

async function handleCallbackQuery(env: Env, callbackQuery: TelegramCallbackQuery) {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message?.chat.id;
  const messageId = callbackQuery.message?.message_id;
  const userId = callbackQuery.from.id.toString();
  
  if (!chatId || !messageId) return;
  if (!isAdmin(env, userId)) return await answerCallbackQuery(env, callbackQuery.id, "Unauthorized access", true);

  try {
    if (data === "menu_main") {
      await clearUserState(env, userId);
      await editTelegramMessage(env, chatId, messageId, "👋 <b>Selamat Datang di SOVR Admin Panel</b>\n\nSilakan pilih menu di bawah ini:", mainKeyboard);
    } 
    else if (data === "menu_feed") {
      await clearUserState(env, userId);
      await editTelegramMessage(env, chatId, messageId, "📱 <b>Manajemen Feed</b>\n\nPilih aksi yang ingin dilakukan:", feedKeyboard);
    } 
    else if (data === "f_post") {
      const newState: TelegramState = { menu: "FEED", action: "POST", draft: {}, waitingFor: null, lastMessageId: messageId };
      await setUserState(env, userId, newState);
      const view = renderFeedDraft(newState.draft);
      await editTelegramMessage(env, chatId, messageId, view.text, view.keyboard);
    } 
    else if (data.startsWith("f_input_")) {
      const field = data.split("_")[2];
      const state = await getUserState(env, userId);
      if (!state) return;

      state.waitingFor = field;
      state.lastMessageId = messageId;
      await setUserState(env, userId, state);

      let prompt = `Ketik data untuk <b>${field.toUpperCase()}</b>:`;
      let kb: any = { inline_keyboard: [[{ text: "⬅️ Batal", callback_data: "f_cancel_input" }]] };
      
      if (field === "date") {
        kb = { inline_keyboard: [ [{ text: "⏰ SEKARANG (NOW)", callback_data: "f_set_now" }], [{ text: "⬅️ Batal", callback_data: "f_cancel_input" }] ] };
        prompt = "Masukkan <b>Tanggal</b> (YYYY-MM-DD) atau gunakan waktu sekarang:";
      } else if (field === "category") {
        kb = { inline_keyboard: [
          [{ text: "🤖 AI", callback_data: "f_setcat_AI" }, { text: "🪙 Kripto", callback_data: "f_setcat_Kripto" }],
          [{ text: "📈 Market", callback_data: "f_setcat_Market" }, { text: "🪓 DeFi", callback_data: "f_setcat_DeFi" }],
          [{ text: "⬅️ Batal", callback_data: "f_cancel_input" }]
        ] };
        prompt = "Pilih <b>Kategori</b>:";
      }

      await editTelegramMessage(env, chatId, messageId, prompt, kb);
    } 
    else if (data === "f_cancel_input") {
      const state = await getUserState(env, userId);
      if (!state) return;
      state.waitingFor = null;
      await setUserState(env, userId, state);
      const view = renderFeedDraft(state.draft);
      await editTelegramMessage(env, chatId, messageId, view.text, view.keyboard);
    } 
    else if (data === "f_set_now") {
      const state = await getUserState(env, userId);
      if (!state) return;
      state.draft.date = getTodayDate();
      state.waitingFor = null;
      await setUserState(env, userId, state);
      const view = renderFeedDraft(state.draft);
      await editTelegramMessage(env, chatId, messageId, view.text, view.keyboard);
    } 
    else if (data.startsWith("f_setcat_")) {
      const state = await getUserState(env, userId);
      if (!state) return;
      state.draft.category = data.split("_")[2];
      state.waitingFor = null;
      await setUserState(env, userId, state);
      const view = renderFeedDraft(state.draft);
      await editTelegramMessage(env, chatId, messageId, view.text, view.keyboard);
    } 
    
    // --- AWAL PERUBAHAN ---

    else if (data === "f_submit") {
      const state = await getUserState(env, userId);
      if (!state) return;
      
      const d = state.draft;
      if (!d.title || !d.date || !d.author || !d.category || !d.body) {
        return await answerCallbackQuery(env, callbackQuery.id, "Data penting belum lengkap! Cek kembali.", true);
      }

      const txt = state.action === "EDIT" 
        ? "⚠️ <b>Konfirmasi Perubahan</b>\n\nApakah Anda yakin ingin menyimpan perubahan artikel ini?" 
        : "⚠️ <b>Konfirmasi Posting</b>\n\nApakah Anda yakin ingin mempublikasikan feed ini?";

      const kb = { inline_keyboard: [
        [{ text: "✅ Ya, Simpan!", callback_data: "f_confirm_post" }, { text: "❌ Tidak, Cek Lagi", callback_data: "f_cancel_input" }]
      ] };
      await editTelegramMessage(env, chatId, messageId, txt, kb);
    } 
    else if (data === "f_confirm_post") {
      const state = await getUserState(env, userId);
      if (!state) return;
      
      const d = state.draft;
      let icon = "ri-newspaper-line", tagBaru = "Market", slugDB = "market";
      
      if (d.category) {
        const catSlug = d.category.toLowerCase();
        if (catSlug.includes("ai")) { icon = "ri-sparkling-2-line"; tagBaru = "AI"; slugDB = "ai"; }
        else if (catSlug.includes("kripto")) { icon = "ri-coin-line"; tagBaru = "Kripto"; slugDB = "kripto"; }
        else if (catSlug.includes("market")) { icon = "ri-line-chart-line"; tagBaru = "Market"; slugDB = "market"; }
        else if (catSlug.includes("defi")) { icon = "ri-swap-line"; tagBaru = "DeFi"; slugDB = "defi"; }
      }

      const sourceUrl = d.source && d.source.startsWith("http") ? d.source : "#";
      let sourceName = "SOVR Internal";
      if (sourceUrl !== "#") {
        try { sourceName = new URL(sourceUrl).hostname.replace('www.', ''); } catch(e) { sourceName = "Eksternal"; }
      }

      if (state.action === "EDIT" && d.id) {
        const updateQuery = `UPDATE articles SET tag=?, category=?, title=?, body=?, author=?, source_name=?, source_url=?, source_logo=?, published_date=? WHERE id=?`;
        await env.sovr_db.prepare(updateQuery).bind(tagBaru, slugDB, d.title, d.body, d.author, sourceName, sourceUrl, icon, d.date, d.id).run();
        await clearUserState(env, userId);
        const kb = { inline_keyboard: [[{ text: "⬅️ Menu Utama", callback_data: "menu_main" }]] };
        await editTelegramMessage(env, chatId, messageId, `✅ <b>SUKSES!</b>\n\nArtikel berhasil diperbarui!\nID: ${d.id}`, kb);
      } else {
        const insertQuery = `INSERT INTO articles (tag, category, title, body, author, source_name, source_url, source_logo, published_date, status, featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', 0) RETURNING id`;
        const result: any = await env.sovr_db.prepare(insertQuery).bind(tagBaru, slugDB, d.title, d.body, d.author, sourceName, sourceUrl, icon, d.date).first();
        await clearUserState(env, userId);
        const kb = { inline_keyboard: [[{ text: "⬅️ Menu Utama", callback_data: "menu_main" }]] };
        await editTelegramMessage(env, chatId, messageId, `✅ <b>SUKSES!</b>\n\nArtikel berhasil dipublikasikan!\nID: ${result?.id}`, kb);
      }
    } 
    // --- AWAL PERUBAHAN ---

    else if (data === "f_list" || data.startsWith("f_list_") || 
             data === "f_edit" || data.startsWith("f_edit_") || 
             data === "f_delete" || data.startsWith("f_delete_")) {
      
      const parts = data.split("_");
      const action = parts[1]; // "list", "edit", atau "delete"
      const page = parts.length > 2 ? parseInt(parts[2]) : 0;
      const limit = 5; // Dibuat 5 per halaman agar tampilan tombol/teks tetap rapi di HP
      const offset = page * limit;

      // Trik AI: Kita query limit + 1 (yaitu 6) untuk mendeteksi apakah ada halaman 'Next' atau tidak
      const { results } = await env.sovr_db.prepare(`SELECT id, title, category, published_date FROM articles ORDER BY id DESC LIMIT ? OFFSET ?`).bind(limit + 1, offset).all();
      
      const hasNext = results && results.length > limit;
      const items = results ? results.slice(0, limit) : [];

      if (items.length === 0) {
        return await editTelegramMessage(env, chatId, messageId, "📭 <b>Belum ada artikel.</b>", { inline_keyboard: [[{ text: "⬅️ Kembali", callback_data: "menu_feed" }]] });
      }

      const kb: any = { inline_keyboard: [] };
      let msg = "";

      // Render mode List (Hanya Teks)
      if (action === "list") {
        msg = `📋 <b>Daftar Artikel (Halaman ${page + 1}):</b>\n\n`;
        items.forEach((a: any) => { 
          msg += `🆔 <b>${a.id}</b> | [${a.category}]\n📌 ${a.title}\n📅 ${a.published_date}\n\n`; 
        });
      } 
      // Render mode Edit/Delete (Mode Tombol Interaktif)
      else {
        const actionType = action === "edit" ? "EDIT" : "DELETE";
        msg = `Pilih artikel yang ingin di-<b>${actionType}</b>:\n<i>(Halaman ${page + 1})</i>`;
        items.forEach((a: any) => {
          const shortTitle = a.title.length > 25 ? a.title.substring(0, 25) + "..." : a.title;
          kb.inline_keyboard.push([{ text: `ID: ${a.id} - ${shortTitle}`, callback_data: `f_${action === "edit" ? "ed" : "de"}_${a.id}` }]);
        });
      }

      // Render Tombol Navigasi Pagination
      const navButtons = [];
      if (page > 0) {
        navButtons.push({ text: "⬅️ Prev", callback_data: `f_${action}_${page - 1}` });
      }
      if (hasNext) {
        navButtons.push({ text: "Next ➡️", callback_data: `f_${action}_${page + 1}` });
      }
      
      if (navButtons.length > 0) {
        kb.inline_keyboard.push(navButtons);
      }
      kb.inline_keyboard.push([{ text: "⬅️ Kembali ke Menu", callback_data: "menu_feed" }]);

      await editTelegramMessage(env, chatId, messageId, msg, kb);
    }

// --- BATAS PERUBAHAN ---
    else if (data.startsWith("f_ed_")) {
      const articleId = data.split("_")[2];
      const article: any = await env.sovr_db.prepare(`SELECT * FROM articles WHERE id = ?`).bind(articleId).first();
      if (!article) return await answerCallbackQuery(env, callbackQuery.id, "Artikel tidak ditemukan!", true);
      
      let cat = article.category || "";
      if (cat.toLowerCase() === "kripto") cat = "Kripto";
      else if (cat.toLowerCase() === "market") cat = "Market";
      else if (cat.toLowerCase() === "ai") cat = "AI";
      else if (cat.toLowerCase() === "defi") cat = "DeFi";

      const newState: TelegramState = { 
        menu: "FEED", 
        action: "EDIT", 
        draft: { 
          id: article.id,
          title: article.title,
          date: article.published_date,
          author: article.author,
          category: cat,
          source: article.source_url === "#" ? "" : article.source_url,
          body: article.body
        }, 
        waitingFor: null, 
        lastMessageId: messageId 
      };
      await setUserState(env, userId, newState);
      const view = renderFeedDraft(newState.draft);
      await editTelegramMessage(env, chatId, messageId, view.text, view.keyboard);
    }
    else if (data.startsWith("f_de_")) {
      const articleId = data.split("_")[2];
      const article: any = await env.sovr_db.prepare(`SELECT title FROM articles WHERE id = ?`).bind(articleId).first();
      if (!article) return await answerCallbackQuery(env, callbackQuery.id, "Artikel tidak ditemukan!", true);
      
      const kb = { inline_keyboard: [
        [{ text: "✅ Ya, Hapus!", callback_data: `f_delc_${articleId}` }, { text: "❌ Batal", callback_data: "menu_feed" }]
      ] };
      await editTelegramMessage(env, chatId, messageId, `⚠️ <b>Konfirmasi Hapus</b>\n\nApakah Anda yakin ingin menghapus artikel:\n<i>${article.title}</i>`, kb);
    }

    // --- AWAL PERUBAHAN 3 ---
    else if (data === "menu_vault") {
      await clearUserState(env, userId);
      await editTelegramMessage(env, chatId, messageId, "🔒 <b>Manajemen Vault</b>\n\nPilih aksi yang ingin dilakukan:", vaultKeyboard);
    }
    else if (data === "v_post") {
      const newState: TelegramState = { menu: "VAULT", action: "POST", draft: {}, waitingFor: null, lastMessageId: messageId };
      await setUserState(env, userId, newState);
      const view = renderVaultDraft(newState.draft);
      await editTelegramMessage(env, chatId, messageId, view.text, view.keyboard);
    }
    // --- AWAL PERUBAHAN ---
    else if (data.startsWith("v_input_")) {
      const field = data.split("_")[2];
      const state = await getUserState(env, userId);
      if (!state) return;

      state.waitingFor = field;
      state.lastMessageId = messageId;
      await setUserState(env, userId, state);

      let prompt = `Ketik data untuk <b>${field.toUpperCase()}</b>:`;
      let kb: any = { inline_keyboard: [[{ text: "⬅️ Batal", callback_data: "v_cancel_input" }]] };
      
      if (field === "category") {
        kb = { inline_keyboard: [
          [{ text: "💬 Chat", callback_data: "v_setcat_Chat" }, { text: "🤖 Agent", callback_data: "v_setcat_Agent" }],
          [{ text: "⚡ Productivity", callback_data: "v_setcat_Productivity" }, { text: "🖼️ Image", callback_data: "v_setcat_Image" }],
          [{ text: "🎥 Video", callback_data: "v_setcat_Video" }, { text: "🛠️ Other", callback_data: "v_setcat_Other" }],
          [{ text: "⬅️ Batal", callback_data: "v_cancel_input" }]
        ] };
        prompt = "Pilih <b>Kategori</b> untuk Tool ini:";
      } else if (field === "pricing") {
        kb = { inline_keyboard: [
          [{ text: "🆓 Free", callback_data: "v_setpri_Free" }, { text: "💎 Freemium", callback_data: "v_setpri_Freemium" }, { text: "💰 Paid", callback_data: "v_setpri_Paid" }],
          [{ text: "⬅️ Batal", callback_data: "v_cancel_input" }]
        ] };
        prompt = "Pilih model <b>Pricing</b>:";
      } else if (field === "platform") {
        kb = { inline_keyboard: [
          [{ text: "🖥️ Web", callback_data: "v_setplat_Web" }, { text: "🤖 Telegram", callback_data: "v_setplat_Telegram" }],
          [{ text: "📱 Android", callback_data: "v_setplat_Android" }, { text: "🪟 Windows", callback_data: "v_setplat_Windows" }],
          [{ text: "🍏 iOS", callback_data: "v_setplat_iOS" }, { text: "💻 CLI", callback_data: "v_setplat_CLI" }],
          [{ text: "🌐 PWA", callback_data: "v_setplat_PWA" }],
          [{ text: "⬅️ Batal", callback_data: "v_cancel_input" }]
        ] };
        prompt = "Pilih <b>Platform</b> yang didukung:";
      }

      await editTelegramMessage(env, chatId, messageId, prompt, kb);
    }
    else if (data === "v_cancel_input") {
      const state = await getUserState(env, userId);
      if (!state) return;
      state.waitingFor = null;
      await setUserState(env, userId, state);
      const view = renderVaultDraft(state.draft);
      await editTelegramMessage(env, chatId, messageId, view.text, view.keyboard);
    }
    else if (data.startsWith("v_setcat_") || data.startsWith("v_setpri_") || data.startsWith("v_setplat_")) {
      const state = await getUserState(env, userId);
      if (!state) return;
      
      if (data.startsWith("v_setcat_")) state.draft.category = data.split("_")[2];
      if (data.startsWith("v_setpri_")) state.draft.pricing = data.split("_")[2];
      if (data.startsWith("v_setplat_")) state.draft.platform = data.split("_")[2];
      
      state.waitingFor = null;
      await setUserState(env, userId, state);
      const view = renderVaultDraft(state.draft);
      await editTelegramMessage(env, chatId, messageId, view.text, view.keyboard);
    }
// --- BATAS PERUBAHAN ---
    else if (data === "v_submit") {
      const state = await getUserState(env, userId);
      if (!state) return;
      
      const d = state.draft;
      if (!d.name || !d.logo || !d.description || !d.category || !d.pricing || !d.platform || !d.url || !d.summary) {
        return await answerCallbackQuery(env, callbackQuery.id, "Data penting belum lengkap! Cek kembali.", true);
      }

      const txt = state.action === "EDIT" 
        ? "⚠️ <b>Konfirmasi Perubahan</b>\n\nApakah Anda yakin ingin menyimpan perubahan Vault Tool ini?" 
        : "⚠️ <b>Konfirmasi Simpan</b>\n\nApakah Anda yakin ingin memasukkan Tool ini ke Vault?";

      const kb = { inline_keyboard: [
        [{ text: "✅ Ya, Simpan!", callback_data: "v_confirm_post" }, { text: "❌ Tidak, Cek Lagi", callback_data: "v_cancel_input" }]
      ] };
      await editTelegramMessage(env, chatId, messageId, txt, kb);
    }
    else if (data === "v_confirm_post") {
      const state = await getUserState(env, userId);
      if (!state) return;
      
      const d = state.draft;
      
      if (state.action === "EDIT" && d.id) {
        const q = `UPDATE vault_tools SET name=?, logo=?, description=?, category=?, pricing=?, platform=?, url=?, summary=? WHERE id=?`;
        await env.sovr_db.prepare(q).bind(d.name, d.logo, d.description, d.category, d.pricing, d.platform, d.url, d.summary, d.id).run();
        await clearUserState(env, userId);
        const kb = { inline_keyboard: [[{ text: "⬅️ Menu Utama", callback_data: "menu_main" }]] };
        await editTelegramMessage(env, chatId, messageId, `✅ <b>SUKSES!</b>\n\nTool Vault berhasil diperbarui!\nID: ${d.id}`, kb);
      } else {
        const q = `INSERT INTO vault_tools (name, logo, description, category, pricing, platform, url, summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`;
        const res: any = await env.sovr_db.prepare(q).bind(d.name, d.logo, d.description, d.category, d.pricing, d.platform, d.url, d.summary).first();
        await clearUserState(env, userId);
        const kb = { inline_keyboard: [[{ text: "⬅️ Menu Utama", callback_data: "menu_main" }]] };
        await editTelegramMessage(env, chatId, messageId, `✅ <b>SUKSES!</b>\n\nTool berhasil diluncurkan ke Vault!\nID: ${res?.id}`, kb);
      }
    }
    else if (data === "v_list" || data.startsWith("v_list_") || 
             data === "v_edit" || data.startsWith("v_edit_") || 
             data === "v_delete" || data.startsWith("v_delete_")) {
      
      const parts = data.split("_");
      const action = parts[1];
      const page = parts.length > 2 ? parseInt(parts[2]) : 0;
      const limit = 5;
      const offset = page * limit;

      const { results } = await env.sovr_db.prepare(`SELECT id, name, category FROM vault_tools ORDER BY id DESC LIMIT ? OFFSET ?`).bind(limit + 1, offset).all();
      const hasNext = results && results.length > limit;
      const items = results ? results.slice(0, limit) : [];

      if (items.length === 0) {
        return await editTelegramMessage(env, chatId, messageId, "📭 <b>Belum ada Tool di Vault.</b>", { inline_keyboard: [[{ text: "⬅️ Kembali", callback_data: "menu_vault" }]] });
      }

      const kb: any = { inline_keyboard: [] };
      let msg = "";

      if (action === "list") {
        msg = `📋 <b>Daftar Vault (Halaman ${page + 1}):</b>\n\n`;
        items.forEach((a: any) => { msg += `🆔 <b>${a.id}</b> | [${a.category}]\n📌 ${a.name}\n\n`; });
      } else {
        const actionType = action === "edit" ? "EDIT" : "DELETE";
        msg = `Pilih Tool yang ingin di-<b>${actionType}</b>:\n<i>(Halaman ${page + 1})</i>`;
        items.forEach((a: any) => {
          const shortName = a.name.length > 25 ? a.name.substring(0, 25) + "..." : a.name;
          kb.inline_keyboard.push([{ text: `ID: ${a.id} - ${shortName}`, callback_data: `v_${action === "edit" ? "ed" : "de"}_${a.id}` }]);
        });
      }

      const navButtons = [];
      if (page > 0) navButtons.push({ text: "⬅️ Prev", callback_data: `v_${action}_${page - 1}` });
      if (hasNext) navButtons.push({ text: "Next ➡️", callback_data: `v_${action}_${page + 1}` });
      if (navButtons.length > 0) kb.inline_keyboard.push(navButtons);
      kb.inline_keyboard.push([{ text: "⬅️ Kembali", callback_data: "menu_vault" }]);

      await editTelegramMessage(env, chatId, messageId, msg, kb);
    }
    else if (data.startsWith("v_ed_")) {
      const toolId = data.split("_")[2];
      const tool: any = await env.sovr_db.prepare(`SELECT * FROM vault_tools WHERE id = ?`).bind(toolId).first();
      if (!tool) return await answerCallbackQuery(env, callbackQuery.id, "Tool not found", true);
      
      const newState: TelegramState = { 
        menu: "VAULT", action: "EDIT", 
        draft: { 
          id: tool.id, name: tool.name, logo: tool.logo, description: tool.description, 
          category: tool.category, pricing: tool.pricing, platform: tool.platform, url: tool.url, summary: tool.summary 
        }, 
        waitingFor: null, lastMessageId: messageId 
      };
      await setUserState(env, userId, newState);
      const view = renderVaultDraft(newState.draft);
      await editTelegramMessage(env, chatId, messageId, view.text, view.keyboard);
    }
    else if (data.startsWith("v_de_")) {
      const toolId = data.split("_")[2];
      const tool: any = await env.sovr_db.prepare(`SELECT name FROM vault_tools WHERE id = ?`).bind(toolId).first();
      if (!tool) return await answerCallbackQuery(env, callbackQuery.id, "Tool not found", true);
      
      const kb = { inline_keyboard: [
        [{ text: "✅ Ya, Hapus!", callback_data: `v_delc_${toolId}` }, { text: "❌ Batal", callback_data: "menu_vault" }]
      ] };
      await editTelegramMessage(env, chatId, messageId, `⚠️ <b>Konfirmasi Hapus</b>\n\nApakah Anda yakin ingin menghapus Tool:\n<i>${tool.name}</i>`, kb);
    }
    else if (data.startsWith("v_delc_")) {
      const toolId = data.split("_")[2];
      await env.sovr_db.prepare(`DELETE FROM vault_tools WHERE id = ?`).bind(toolId).run();
      const kb = { inline_keyboard: [[{ text: "⬅️ Kembali", callback_data: "menu_vault" }]] };
      await editTelegramMessage(env, chatId, messageId, `✅ <b>SUKSES!</b>\n\nTool dengan ID ${toolId} berhasil dihapus.`, kb);
    }
    
    // --- AWAL PERUBAHAN ---
    else if (data === "menu_editor" || data.startsWith("e_list_") || data.startsWith("e_toggle_")) {
      const parts = data.split("_");
      let page = 0;
      
      if (data.startsWith("e_list_")) {
        page = parseInt(parts[2]);
      } else if (data.startsWith("e_toggle_")) {
        const articleId = parts[2];
        page = parseInt(parts[3] || "0");
        
        await env.sovr_db.prepare(`UPDATE articles SET featured = CASE WHEN featured = 1 THEN 0 ELSE 1 END WHERE id = ?`).bind(articleId).run();
      }

      const limit = 5;
      const offset = page * limit;

      const { results } = await env.sovr_db.prepare(`SELECT id, title, featured FROM articles ORDER BY id DESC LIMIT ? OFFSET ?`).bind(limit + 1, offset).all();
      const hasNext = results && results.length > limit;
      const items = results ? results.slice(0, limit) : [];

      if (items.length === 0) {
        return await editTelegramMessage(env, chatId, messageId, "📭 <b>Belum ada artikel.</b>", { inline_keyboard: [[{ text: "⬅️ Kembali", callback_data: "menu_main" }]] });
      }

      const kb: any = { inline_keyboard: [] };
      let msg = `⭐ <b>Pilihan Editor (Halaman ${page + 1})</b>\n\nKlik tombol di bawah untuk mengubah status artikel:\n\n`;
      
      items.forEach((a: any) => {
        const isFeatured = a.featured === 1;
        const shortTitle = a.title.length > 30 ? a.title.substring(0, 30) + "..." : a.title;
        const icon = isFeatured ? "⭐" : "➖";
        
        msg += `${icon} <b>ID: ${a.id}</b> | ${shortTitle}\n`;
        kb.inline_keyboard.push([{ text: `${isFeatured ? "❌ Hapus dari Pilihan Editor" : "⭐ Jadikan Pilihan Editor"} (ID: ${a.id})`, callback_data: `e_toggle_${a.id}_${page}` }]);
      });

      const navButtons = [];
      if (page > 0) navButtons.push({ text: "⬅️ Prev", callback_data: `e_list_${page - 1}` });
      if (hasNext) navButtons.push({ text: "Next ➡️", callback_data: `e_list_${page + 1}` });
      
      if (navButtons.length > 0) kb.inline_keyboard.push(navButtons);
      kb.inline_keyboard.push([{ text: "⬅️ Kembali ke Menu Utama", callback_data: "menu_main" }]);

      await editTelegramMessage(env, chatId, messageId, msg, kb);
    }
// --- BATAS PERUBAHAN ---

    else if (data.startsWith("f_delc_")) {
      const articleId = data.split("_")[2];
      await env.sovr_db.prepare(`DELETE FROM articles WHERE id = ?`).bind(articleId).run();
      const kb = { inline_keyboard: [[{ text: "⬅️ Kembali", callback_data: "menu_feed" }]] };
      await editTelegramMessage(env, chatId, messageId, `✅ <b>SUKSES!</b>\n\nArtikel dengan ID ${articleId} berhasil dihapus.`, kb);
    }
    else if (data === "menu_vault" || data === "menu_editor") {
      const kb = { inline_keyboard: [[{ text: "⬅️ Kembali", callback_data: "menu_main" }]] };
      await editTelegramMessage(env, chatId, messageId, "🚧 <i>Modul ini akan disambungkan pada langkah berikutnya.</i>", kb);
    }

    // --- AWAL PERUBAHAN TAHAP 4 ---
    else if (data === "menu_perspectives") {
      await clearUserState(env, userId);
      await editTelegramMessage(env, chatId, messageId, "🔭 <b>Manajemen Perspectives (Blog Eksklusif)</b>\n\nPilih aksi yang ingin dilakukan:", perspectivesKeyboard);
    }
    else if (data === "p_post") {
      const newState: TelegramState = { menu: "PERSPECTIVES", action: "POST", draft: {}, waitingFor: null, lastMessageId: messageId };
      await setUserState(env, userId, newState);
      const view = renderPerspectivesDraft(newState.draft);
      await editTelegramMessage(env, chatId, messageId, view.text, view.keyboard);
    }
    else if (data.startsWith("p_input_")) {
      const field = data.split("_")[2];
      const state = await getUserState(env, userId);
      if (!state) return;

      state.waitingFor = field;
      state.lastMessageId = messageId;
      await setUserState(env, userId, state);

      let prompt = `Ketik data teks (Mendukung HTML bawaan Telegram) untuk <b>${field.toUpperCase()}</b>:`;
      let kb: any = { inline_keyboard: [[{ text: "⬅️ Batal", callback_data: "p_cancel_input" }]] };
      
      if (field === "date") {
        kb = { inline_keyboard: [ [{ text: "⏰ SEKARANG (NOW)", callback_data: "p_set_now" }], [{ text: "⬅️ Batal", callback_data: "p_cancel_input" }] ] };
        prompt = "Masukkan <b>Tanggal</b> (YYYY-MM-DD) atau klik tombol instan:";
      } else if (field === "category") {
        kb = { inline_keyboard: [
          [{ text: "🤖 AI", callback_data: "p_setcat_AI" }, { text: "🪙 Kripto", callback_data: "p_setcat_Kripto" }],
          [{ text: "📈 Market", callback_data: "p_setcat_Market" }, { text: "🪓 DeFi", callback_data: "p_setcat_DeFi" }],
          [{ text: "⬅️ Batal", callback_data: "p_cancel_input" }]
        ] };
        prompt = "Pilih <b>Kategori Utama</b> editorial:";
      } else if (field === "image") {
        prompt = "Masukkan <b>Link URL Gambar Utama (Hero Image)</b> untuk sampul artikel:";
      }

      await editTelegramMessage(env, chatId, messageId, prompt, kb);
    }
    else if (data === "p_cancel_input") {
      const state = await getUserState(env, userId);
      if (!state) return;
      state.waitingFor = null;
      await setUserState(env, userId, state);
      const view = renderPerspectivesDraft(state.draft);
      await editTelegramMessage(env, chatId, messageId, view.text, view.keyboard);
    }
    else if (data === "p_set_now") {
      const state = await getUserState(env, userId);
      if (!state) return;
      state.draft.date = getTodayDate();
      state.waitingFor = null;
      await setUserState(env, userId, state);
      const view = renderPerspectivesDraft(state.draft);
      await editTelegramMessage(env, chatId, messageId, view.text, view.keyboard);
    }
    else if (data.startsWith("p_setcat_")) {
      const state = await getUserState(env, userId);
      if (!state) return;
      state.draft.category = data.split("_")[2];
      state.waitingFor = null;
      await setUserState(env, userId, state);
      const view = renderPerspectivesDraft(state.draft);
      await editTelegramMessage(env, chatId, messageId, view.text, view.keyboard);
    }
    else if (data === "p_submit") {
      const state = await getUserState(env, userId);
      if (!state) return;
      
      const d = state.draft;
      if (!d.title || !d.date || !d.author || !d.category || !d.image || !d.body) {
        return await answerCallbackQuery(env, callbackQuery.id, "Data Perspectives belum lengkap!", true);
      }

      const txt = state.action === "EDIT" ? "⚠️ <b>Konfirmasi Perubahan</b>\n\nSimpan revisi artikel editorial ini?" : "⚠️ <b>Konfirmasi Publikasi</b>\n\nTerbitkan artikel mendalam ini ke ruang Perspectives?";
      const kb = { inline_keyboard: [[{ text: "✅ Ya, Eksekusi!", callback_data: "p_confirm_post" }, { text: "❌ Cek Lagi", callback_data: "p_cancel_input" }]] };
      await editTelegramMessage(env, chatId, messageId, txt, kb);
    }
    // --- AWAL PERUBAHAN p_confirm_post ---
    else if (data === "p_confirm_post") {
      const state = await getUserState(env, userId);
      if (!state) return;
      const d = state.draft;
      const secureImg = optimizeImage(d.image);

      if (state.action === "EDIT" && d.id) {
        const q = `UPDATE perspectives SET title=?, image_url=?, body=?, author=?, category=?, published_date=? WHERE id=?`;
        await env.sovr_db.prepare(q).bind(d.title, secureImg, d.body, d.author, d.category, d.date, d.id).run();
        await clearUserState(env, userId);
        await editTelegramMessage(env, chatId, messageId, `✅ <b>SUKSES REVISI!</b>\n\nArtikel Perspectives ID ${d.id} berhasil diperbarui.`, { inline_keyboard: [[{ text: "⬅️ Menu Utama", callback_data: "menu_main" }]] });
      } else {
        const q = `INSERT INTO perspectives (title, image_url, body, author, category, views, published_date) VALUES (?, ?, ?, ?, ?, 0, ?) RETURNING id`;
        const res: any = await env.sovr_db.prepare(q).bind(d.title, secureImg, d.body, d.author, d.category, d.date).first();
        await clearUserState(env, userId);
        await editTelegramMessage(env, chatId, messageId, `✅ <b>SUKSES TERBIT!</b>\n\nArtikel berhasil dipublikasikan ke halaman Perspectives!\nID: ${res?.id}`, { inline_keyboard: [[{ text: "⬅️ Menu Utama", callback_data: "menu_main" }]] });
      }
    }
// --- BATAS PERUBAHAN p_confirm_post ---
    else if (data === "p_list" || data.startsWith("p_list_") || data === "p_edit" || data.startsWith("p_edit_") || data === "p_delete" || data.startsWith("p_delete_")) {
      const parts = data.split("_");
      const action = parts[1];
      const page = parts.length > 2 ? parseInt(parts[2]) : 0;
      const limit = 5;
      const offset = page * limit;

      const { results } = await env.sovr_db.prepare(`SELECT id, title, category FROM perspectives ORDER BY id DESC LIMIT ? OFFSET ?`).bind(limit + 1, offset).all();
      const hasNext = results && results.length > limit;
      const items = results ? results.slice(0, limit) : [];

      if (items.length === 0) {
        return await editTelegramMessage(env, chatId, messageId, "📭 <b>Belum ada artikel Perspectives.</b>", { inline_keyboard: [[{ text: "⬅️ Kembali", callback_data: "menu_perspectives" }]] });
      }

      const kb: any = { inline_keyboard: [] };
      let msg = "";

      if (action === "list") {
        msg = `📋 <b>Daftar Perspectives (Halaman ${page + 1}):</b>\n\n`;
        items.forEach((a: any) => { msg += `🆔 <b>${a.id}</b> | [${a.category}]\n🔭 ${a.title}\n\n`; });
      } else {
        msg = `Pilih artikel yang ingin di-<b>${action === "edit" ? "EDIT" : "DELETE"}</b>:\n<i>(Halaman ${page + 1})</i>`;
        items.forEach((a: any) => {
          const short = a.title.length > 25 ? a.title.substring(0, 25) + "..." : a.title;
          kb.inline_keyboard.push([{ text: `ID: ${a.id} - ${short}`, callback_data: `p_${action === "edit" ? "ed" : "de"}_${a.id}` }]);
        });
      }

      const nav = [];
      if (page > 0) nav.push({ text: "⬅️ Prev", callback_data: `p_${action}_${page - 1}` });
      if (hasNext) nav.push({ text: "Next ➡️", callback_data: `p_${action}_${page + 1}` });
      if (nav.length > 0) kb.inline_keyboard.push(nav);
      kb.inline_keyboard.push([{ text: "⬅️ Kembali", callback_data: "menu_perspectives" }]);

      await editTelegramMessage(env, chatId, messageId, msg, kb);
    }
    else if (data.startsWith("p_ed_")) {
      const artId = data.split("_")[2];
      const art: any = await env.sovr_db.prepare(`SELECT * FROM perspectives WHERE id = ?`).bind(artId).first();
      if (!art) return await answerCallbackQuery(env, callbackQuery.id, "Article not found", true);

      const newState: TelegramState = {
        menu: "PERSPECTIVES", action: "EDIT",
        draft: { id: art.id, title: art.title, image: art.image_url, body: art.body, author: art.author, category: art.category, date: art.published_date },
        waitingFor: null, lastMessageId: messageId
      };
      await setUserState(env, userId, newState);
      const view = renderPerspectivesDraft(newState.draft);
      await editTelegramMessage(env, chatId, messageId, view.text, view.keyboard);
    }
    else if (data.startsWith("p_de_")) {
      const artId = data.split("_")[2];
      const art: any = await env.sovr_db.prepare(`SELECT title FROM perspectives WHERE id = ?`).bind(artId).first();
      if (!art) return await answerCallbackQuery(env, callbackQuery.id, "Article not found", true);

      const kb = { inline_keyboard: [[{ text: "✅ Ya, Hapus!", callback_data: `p_delc_${artId}` }, { text: "❌ Batal", callback_data: "menu_perspectives" }]] };
      await editTelegramMessage(env, chatId, messageId, `⚠️ <b>Konfirmasi Hapus</b>\n\nHapus artikel editorial:\n<i>${art.title}</i>?`, kb);
    }
    else if (data.startsWith("p_delc_")) {
      const artId = data.split("_")[2];
      await env.sovr_db.prepare(`DELETE FROM perspectives WHERE id = ?`).bind(artId).run();
      await editTelegramMessage(env, chatId, messageId, `✅ <b>SUKSES!</b>\n\nArtikel ID ${artId} berhasil dihapus permanen.`, { inline_keyboard: [[{ text: "⬅️ Kembali", callback_data: "menu_perspectives" }]] });
    }
// --- BATAS PERUBAHAN TAHAP 4 ---

// --- BATAS PERUBAHAN ---
    
    await answerCallbackQuery(env, callbackQuery.id, "");
  } catch (error) {
    console.error("Callback query error:", error);
    await answerCallbackQuery(env, callbackQuery.id, "Internal Server Error", true);
  }

  
  
}

// --- BATAS PERUBAHAN ---

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

    // --- AWAL PERUBAHAN TAHAP 5 ---
    if (url.pathname === "/api/perspectives" && request.method === "GET") {
      const id = url.searchParams.get("id");
      
      if (id) {
        await env.sovr_db.prepare(`UPDATE perspectives SET views = views + 1 WHERE id = ?`).bind(id).run();
        const article = await env.sovr_db.prepare(`SELECT * FROM perspectives WHERE id = ?`).bind(id).first();
        if (!article) return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers: corsHeaders });
        return new Response(JSON.stringify(article), { status: 200, headers: corsHeaders });
      }

      const sort = url.searchParams.get("sort") || "latest";
      const category = url.searchParams.get("category");
      
      let query = `SELECT * FROM perspectives`;
      const params: any[] = [];
      
      if (category) {
        query += ` WHERE LOWER(category) = ?`;
        params.push(category.toLowerCase());
      }
      
      if (sort === "top") {
        query += ` ORDER BY views DESC, id DESC`;
      } else {
        query += ` ORDER BY id DESC`;
      }
      
      const { results } = await env.sovr_db.prepare(query).bind(...params).all();
      return new Response(JSON.stringify(results), { status: 200, headers: corsHeaders });
    }
// --- BATAS PERUBAHAN TAHAP 5 ---

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