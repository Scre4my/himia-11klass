const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

app.use(cors());
app.use(express.json());

// Защита от SQL-инъекций: валидация входных данных
const sanitizeInput = (str) => {
  if (typeof str !== 'string') return str;
  // Экранирование специальных символов
  return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, (char) => {
    switch (char) {
      case "\0": return "\\0";
      case "\x08": return "\\b";
      case "\x09": return "\\t";
      case "\x1a": return "\\z";
      case "\n": return "\\n";
      case "\r": return "\\r";
      case "'": return "''";
      case '"': return "\\\"";
      case "\\": return "\\\\";
      case "%": return "\\%";
      default: return char;
    }
  });
};

// Валидация типов данных
const validateProductData = (data) => {
  const errors = [];

  if (data.name && (typeof data.name !== 'string' || data.name.length > 255)) {
    errors.push('Некорректное название товара');
  }

  if (data.description && typeof data.description !== 'string') {
    errors.push('Некорректное описание');
  }

  if (data.price && (typeof data.price !== 'number' || data.price < 0 || data.price > 999999999)) {
    errors.push('Некорректная цена');
  }

  if (data.category && (typeof data.category !== 'string' || data.category.length > 100)) {
    errors.push('Некорректная категория');
  }

  return errors;
};

// Rate limiting (простой)
const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 минута
const RATE_LIMIT_MAX = 100; // макс запросов

const rateLimitMiddleware = (req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  const userRequests = rateLimit.get(ip) || [];

  const recentRequests = userRequests.filter(time => now - time < RATE_LIMIT_WINDOW);
  recentRequests.push(now);
  rateLimit.set(ip, recentRequests);

  if (recentRequests.length > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Слишком много запросов' });
  }

  next();
};

app.use(rateLimitMiddleware);

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'products_db',
});

pool.on('connect', () => {
  console.log('✅ Подключено к PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Ошибка подключения к PostgreSQL:', err);
});

// JWT Middleware для проверки авторизации
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Недействительный токен' });
    }
    req.user = user;
    next();
  });
};

// Инициализация БД
const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        image TEXT,
        category VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Создаем админскую учетку если её нет
    const adminExists = await pool.query('SELECT * FROM users WHERE username = $1', ['admin']);
    if (adminExists.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await pool.query(
        'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)',
        ['admin', hashedPassword, 'admin']
      );
      console.log('✅ Создана учетная запись администратора');
    }

    console.log('✅ База данных инициализирована');
  } catch (err) {
    console.error('❌ Ошибка инициализации БД:', err.message);
  }
};

// === ЭНДПОИНТЫ АВТОРИЗАЦИИ ===

// Регистрация
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Укажите логин и пароль' });
    }

    if (username.length < 3 || password.length < 6) {
      return res.status(400).json({ error: 'Логин минимум 3 символа, пароль минимум 6' });
    }

    const safeUsername = sanitizeInput(username.trim());

    const userExists = await pool.query('SELECT id FROM users WHERE username = $1', [safeUsername]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'Пользователь уже существует' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role',
      [safeUsername, hashedPassword, 'user']
    );

    const token = jwt.sign(
      { id: result.rows[0].id, username: result.rows[0].username, role: result.rows[0].role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Регистрация успешна',
      token,
      user: { id: result.rows[0].id, username: result.rows[0].username, role: result.rows[0].role }
    });
  } catch (err) {
    console.error('Ошибка регистрации:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Логин
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Укажите логин и пароль' });
    }

    const safeUsername = sanitizeInput(username.trim());

    const result = await pool.query('SELECT * FROM users WHERE username = $1', [safeUsername]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Успешный вход',
      token,
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (err) {
    console.error('Ошибка входа:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Проверка токена
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await pool.query('SELECT id, username, role FROM users WHERE id = $1', [req.user.id]);
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    res.json({ user: user.rows[0] });
  } catch (err) {
    console.error('Ошибка получения профиля:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// === ЭНДПОИНТЫ ТОВАРОВ ===

// Получить все товары (публичный)
app.get('/api/products', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = 'SELECT * FROM products';
    const params = [];
    const conditions = [];

    if (category) {
      const safeCategory = sanitizeInput(category);
      conditions.push(`category = $${params.length + 1}`);
      params.push(safeCategory);
    }

    if (search) {
      const safeSearch = sanitizeInput(search);
      conditions.push(`(name ILIKE $${params.length + 1} OR description ILIKE $${params.length + 1})`);
      params.push(`%${safeSearch}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка получения товаров:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить товар по ID (публичный)
app.get('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Валидация UUID
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return res.status(400).json({ error: 'Некорректный ID товара' });
    }

    const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка получения товара:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создать товар (только админ)
app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Доступ только для администраторов' });
    }

    const { name, description, price, image, category } = req.body;

    // Валидация
    const errors = validateProductData({ name, description, price, category });
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(', ') });
    }

    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Название и цена обязательны' });
    }

    const safeName = sanitizeInput(name.trim());
    const safeDescription = sanitizeInput(description?.trim() || '');
    const safeImage = sanitizeInput(image?.trim() || '');
    const safeCategory = sanitizeInput(category?.trim() || '');

    const result = await pool.query(
      `INSERT INTO products (name, description, price, image, category)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [safeName, safeDescription, price, safeImage, safeCategory]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка создания товара:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Обновить товар (только админ)
app.put('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Доступ только для администраторов' });
    }

    const { id } = req.params;

    // Валидация UUID
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return res.status(400).json({ error: 'Некорректный ID товара' });
    }

    const { name, description, price, image, category } = req.body;

    const errors = validateProductData({ name, description, price, category });
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(', ') });
    }

    const existing = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    const safeName = name ? sanitizeInput(name.trim()) : null;
    const safeDescription = description ? sanitizeInput(description.trim()) : null;
    const safeImage = image ? sanitizeInput(image.trim()) : null;
    const safeCategory = category ? sanitizeInput(category.trim()) : null;

    const result = await pool.query(
      `UPDATE products
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           price = COALESCE($3, price),
           image = COALESCE($4, image),
           category = COALESCE($5, category)
       WHERE id = $6
       RETURNING *`,
      [safeName, safeDescription, price, safeImage, safeCategory, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка обновления товара:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Удалить товар (только админ)
app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Доступ только для администраторов' });
    }

    const { id } = req.params;

    // Валидация UUID
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return res.status(400).json({ error: 'Некорректный ID товара' });
    }

    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    res.json({ message: 'Товар удален', product: result.rows[0] });
  } catch (err) {
    console.error('Ошибка удаления товара:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.listen(PORT, async () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  await initDB();
});
