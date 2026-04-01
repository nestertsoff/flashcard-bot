import TelegramBot from 'node-telegram-bot-api';

export function parseCardSet(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return null;

  const title = lines[0].trim();
  const cards = [];

  for (let i = 1; i < lines.length; i++) {
    const sepIdx = lines[i].indexOf(' - ');
    if (sepIdx === -1) continue;
    const word = lines[i].slice(0, sepIdx).trim();
    const translationsRaw = lines[i].slice(sepIdx + 3);
    const translations = translationsRaw.split(',').map(t => t.trim()).filter(Boolean);
    if (word && translations.length > 0) {
      cards.push({ word, translations });
    }
  }

  return cards.length > 0 ? { title, cards } : null;
}

export function createBot(token, db, webAppUrl) {
  const bot = new TelegramBot(token, { polling: true });

  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    db.upsertUser(msg.from.id, msg.from.username || '');
    bot.sendMessage(chatId,
      'Welcome to Flashcard Bot! Send me a word list to create a set:\n\n' +
      'Title\nword1 - translation1, translation2\nword2 - translation1\n\n' +
      'Commands:\n/sets — view your sets\n/share <code> — import a shared set'
    );
  });

  bot.onText(/\/sets/, (msg) => {
    const chatId = msg.chat.id;
    db.upsertUser(msg.from.id, msg.from.username || '');
    const sets = db.listSets(msg.from.id);
    if (sets.length === 0) {
      bot.sendMessage(chatId, 'No sets yet. Send me a word list to create one!');
      return;
    }
    const buttons = sets.map(s => [{
      text: `${s.title} (${s.card_count})`,
      web_app: { url: `${webAppUrl}/app/?setId=${s.id}` },
    }]);
    bot.sendMessage(chatId, 'Your sets:', {
      reply_markup: { inline_keyboard: buttons },
    });
  });

  bot.onText(/\/share (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    db.upsertUser(userId, msg.from.username || '');
    const code = match[1].trim();
    const newSetId = db.importByShareCode(code, userId);
    if (!newSetId) {
      bot.sendMessage(chatId, 'Invalid share code.');
      return;
    }
    const set = db.getSet(newSetId, userId);
    bot.sendMessage(chatId, `Imported "${set.title}" (${set.cards.length} cards)`, {
      reply_markup: {
        inline_keyboard: [[{
          text: 'Learn',
          web_app: { url: `${webAppUrl}/app/?setId=${newSetId}` },
        }]],
      },
    });
  });

  bot.on('message', (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    db.upsertUser(userId, msg.from.username || '');

    const parsed = parseCardSet(msg.text);
    if (!parsed) {
      bot.sendMessage(chatId,
        'Could not parse your message. Use this format:\n\n' +
        'Title\nword1 - translation1, translation2\nword2 - translation1'
      );
      return;
    }

    const setId = db.createSet(userId, parsed.title, parsed.cards);
    bot.sendMessage(chatId, `Set "${parsed.title}" created (${parsed.cards.length} cards)`, {
      reply_markup: {
        inline_keyboard: [[{
          text: 'Learn',
          web_app: { url: `${webAppUrl}/app/?setId=${setId}` },
        }]],
      },
    });
  });

  return bot;
}
