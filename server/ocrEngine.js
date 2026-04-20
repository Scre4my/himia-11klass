'use strict';

/**
 * OCR движки для извлечения таблиц из изображений.
 *
 * Приоритет:
 *  1. Google Gemini Flash (бесплатно, 1500 req/day) — если задан GEMINI_API_KEY
 *  2. Anthropic Claude   (платно)                    — если задан ANTHROPIC_API_KEY
 *  3. Tesseract.js       (бесплатно, офлайн)          — всегда доступен
 */

// ─────────────────────────────────────────────────────────────────
// TESSERACT (офлайн, всегда бесплатно)
// ─────────────────────────────────────────────────────────────────

async function extractWithTesseract(imageBuffer, mediaType) {
  const Tesseract = require('tesseract.js');

  const { data } = await Tesseract.recognize(imageBuffer, 'rus+eng', {
    logger: () => {},
  });

  const rawText = data.text;
  return parseTextToTable(rawText);
}

/**
 * Разбирает OCR-текст в таблицу.
 * Работает для таблиц с разделителями пробелами, табами или |
 */
function parseTextToTable(rawText) {
  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length === 0) {
    throw new Error('Текст на изображении не обнаружен');
  }

  // Определяем разделитель
  const hasPipe  = lines.some(l => l.includes('|'));
  const hasTab   = lines.some(l => l.includes('\t'));

  let rows;
  if (hasPipe) {
    rows = lines
      .filter(l => !/^[-|+\s]+$/.test(l)) // убираем разделительные строки ---|---
      .map(l => l.replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
  } else if (hasTab) {
    rows = lines.map(l => l.split('\t').map(c => c.trim()));
  } else {
    // Пробелы: несколько подряд = разделитель
    rows = lines.map(l => l.split(/\s{2,}/).map(c => c.trim()));
  }

  // Нормализуем количество столбцов
  const colCount = Math.max(...rows.map(r => r.length));
  rows = rows.map(r => {
    while (r.length < colCount) r.push('');
    return r;
  });

  if (rows.length === 0) throw new Error('Не удалось разобрать таблицу');

  const headers = rows[0];
  const dataRows = rows.slice(1);

  // Автоимя
  const name = 'Справочная таблица (Tesseract)';

  return { name, headers, rows: dataRows };
}

// ─────────────────────────────────────────────────────────────────
// GOOGLE GEMINI (бесплатный тир: 15 RPM, 1500 RPD)
// ─────────────────────────────────────────────────────────────────

async function extractWithGemini(imageBuffer, mediaType) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `Извлеки таблицу из этого изображения и верни строго в формате JSON:
{
  "name": "Название таблицы",
  "headers": ["Заголовок1", "Заголовок2"],
  "rows": [["значение1", "значение2"], ...]
}
Только JSON, без пояснений. Числа и единицы измерения сохрани как строки.`;

  const imagePart = {
    inlineData: {
      data: imageBuffer.toString('base64'),
      mimeType: mediaType,
    },
  };

  const result = await model.generateContent([prompt, imagePart]);
  const text = result.response.text().trim();

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Gemini не вернул JSON');

  const parsed = JSON.parse(match[0]);
  if (!parsed.headers || !parsed.rows) throw new Error('Таблица не обнаружена');

  return { ...parsed, name: parsed.name || 'Справочная таблица (Gemini)' };
}

// ─────────────────────────────────────────────────────────────────
// ANTHROPIC CLAUDE (платно)
// ─────────────────────────────────────────────────────────────────

async function extractWithClaude(imageBuffer, mediaType) {
  const Anthropic = require('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBuffer.toString('base64') } },
        { type: 'text', text: `Извлеки таблицу из изображения. Верни только JSON:
{"name":"Название","headers":["Заголовок1",...],"rows":[["значение",...],...]}
Без пояснений. Числа — строками.` }
      ]
    }]
  });

  const text = message.content[0].text.trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Claude не вернул JSON');

  const parsed = JSON.parse(match[0]);
  if (!parsed.headers || !parsed.rows) throw new Error('Таблица не обнаружена');

  return { ...parsed, name: parsed.name || 'Справочная таблица (Claude)' };
}

// ─────────────────────────────────────────────────────────────────
// ГЛАВНАЯ ФУНКЦИЯ — авто-выбор движка
// ─────────────────────────────────────────────────────────────────

/**
 * Возвращает список доступных движков с приоритетом.
 */
function isRealKey(val) {
  return val && val.length > 10 && !val.startsWith('your-');
}

function getAvailableEngines() {
  const engines = [];
  if (isRealKey(process.env.GEMINI_API_KEY))    engines.push('gemini');
  if (isRealKey(process.env.ANTHROPIC_API_KEY)) engines.push('claude');
  engines.push('tesseract'); // всегда доступен
  return engines;
}

/**
 * Извлечь таблицу из изображения.
 * @param {Buffer} imageBuffer  — бинарные данные изображения
 * @param {string} mediaType    — MIME-тип ('image/jpeg', 'image/png', ...)
 * @param {string} [engine]     — 'auto'|'gemini'|'claude'|'tesseract'
 * @returns {{ name, headers, rows, engine }}
 */
async function extractTable(imageBuffer, mediaType, engine = 'auto') {
  const available = getAvailableEngines();

  let selected = engine === 'auto' ? available[0] : engine;

  // Если запрошенный движок недоступен — фоллбэк на tesseract
  if (selected !== 'tesseract' && !available.includes(selected)) {
    console.warn(`Движок "${selected}" недоступен, используется tesseract`);
    selected = 'tesseract';
  }

  let tableData;
  try {
    if (selected === 'gemini') {
      tableData = await extractWithGemini(imageBuffer, mediaType);
    } else if (selected === 'claude') {
      tableData = await extractWithClaude(imageBuffer, mediaType);
    } else {
      tableData = await extractWithTesseract(imageBuffer, mediaType);
    }
  } catch (err) {
    // Если AI-движок упал — фоллбэк на tesseract
    if (selected !== 'tesseract') {
      console.warn(`${selected} упал (${err.message}), переключаемся на Tesseract`);
      tableData = await extractWithTesseract(imageBuffer, mediaType);
      selected = 'tesseract';
    } else {
      throw err;
    }
  }

  return { ...tableData, engine: selected };
}

module.exports = { extractTable, getAvailableEngines };
