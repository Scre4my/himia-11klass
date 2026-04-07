const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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

const initDB = async () => {
  try {
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
    console.log('✅ База данных инициализирована');
  } catch (err) {
    console.error('❌ Ошибка инициализации БД:', err.message);
  }
};

app.get('/api/products', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = 'SELECT * FROM products';
    const params = [];
    const conditions = [];

    if (category) {
      conditions.push(`category = $${params.length + 1}`);
      params.push(category);
    }

    if (search) {
      conditions.push(`(name ILIKE $${params.length + 1} OR description ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
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

app.get('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
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

app.post('/api/products', async (req, res) => {
  try {
    const { name, description, price, image, category } = req.body;

    if (!name || !price) {
      return res.status(400).json({ error: 'Название и цена обязательны' });
    }

    const result = await pool.query(
      `INSERT INTO products (name, description, price, image, category) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [name, description || '', price, image || '', category || '']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка создания товара:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, image, category } = req.body;

    const existing = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    const result = await pool.query(
      `UPDATE products 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           price = COALESCE($3, price),
           image = COALESCE($4, image),
           category = COALESCE($5, category)
       WHERE id = $6
       RETURNING *`,
      [name, description, price, image, category, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка обновления товара:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
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
