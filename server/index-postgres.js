const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const calculationEngine = require('./calculationEngine');
const reportGenerator = require('./reportGenerator');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Sanitize ──────────────────────────────────────────────────────
const sanitizeInput = (str) => {
  if (typeof str !== 'string') return str;
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

const validateProductData = (data) => {
  const errors = [];
  if (data.name && (typeof data.name !== 'string' || data.name.length > 255))
    errors.push('Некорректное название товара');
  if (data.description && typeof data.description !== 'string')
    errors.push('Некорректное описание');
  if (data.price && (typeof data.price !== 'number' || data.price < 0 || data.price > 999999999))
    errors.push('Некорректная цена');
  if (data.category && (typeof data.category !== 'string' || data.category.length > 100))
    errors.push('Некорректная категория');
  return errors;
};

// ── Rate limiting ─────────────────────────────────────────────────
const rateLimit = new Map();
const rateLimitMiddleware = (req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  const recent = (rateLimit.get(ip) || []).filter(t => now - t < 60000);
  recent.push(now);
  rateLimit.set(ip, recent);
  if (recent.length > 100) return res.status(429).json({ error: 'Слишком много запросов' });
  next();
};
app.use(rateLimitMiddleware);

// ── PostgreSQL pool ───────────────────────────────────────────────
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 5432,
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME     || 'himia_db',
});

pool.on('connect', () => console.log('✅ PostgreSQL подключён'));
pool.on('error',   (err) => console.error('❌ Ошибка PostgreSQL:', err));

// ── JWT middleware ────────────────────────────────────────────────
const authenticateToken = (req, res, next) => {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Требуется авторизация' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Недействительный токен' });
    req.user = user;
    next();
  });
};

const isUUID = (id) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// ── Инициализация БД ──────────────────────────────────────────────
const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'engineer',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        image TEXT,
        category VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS calculation_projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        evaporator_type VARCHAR(50) NOT NULL,
        flow_direction VARCHAR(50) NOT NULL,
        number_of_effects INTEGER NOT NULL,
        feed_flow_rate NUMERIC(12,3) NOT NULL,
        initial_concentration NUMERIC(5,2) NOT NULL,
        final_concentration NUMERIC(5,2) NOT NULL,
        steam_temperature NUMERIC(6,2),
        heat_transfer_coefficient NUMERIC(8,2),
        vaporization_heat NUMERIC(8,2),
        condensation_heat NUMERIC(8,2),
        pressure_loss NUMERIC(8,4),
        vacuum_pressure NUMERIC(8,4),
        input_json JSONB,
        result_json JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`
      ALTER TABLE calculation_projects
        ALTER COLUMN steam_temperature DROP NOT NULL,
        ALTER COLUMN heat_transfer_coefficient DROP NOT NULL,
        ALTER COLUMN vaporization_heat DROP NOT NULL,
        ALTER COLUMN condensation_heat DROP NOT NULL;
    `).catch(() => {});
    await pool.query(`
      ALTER TABLE calculation_projects
        ADD COLUMN IF NOT EXISTS input_json JSONB,
        ADD COLUMN IF NOT EXISTS result_json JSONB;
    `).catch(() => {});

    await pool.query(`
      CREATE TABLE IF NOT EXISTS calculation_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES calculation_projects(id) ON DELETE CASCADE,
        stage_number INTEGER NOT NULL,
        temperature NUMERIC(6,2) NOT NULL,
        pressure NUMERIC(8,4) NOT NULL,
        feed_flow_rate NUMERIC(12,3) NOT NULL,
        evaporated_water NUMERIC(12,3) NOT NULL,
        concentration_in NUMERIC(5,2) NOT NULL,
        concentration_out NUMERIC(5,2) NOT NULL,
        steam_consumption NUMERIC(12,3) NOT NULL,
        heat_exchange_area NUMERIC(10,2) NOT NULL,
        heat_load NUMERIC(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS reference_tables (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        source_image TEXT,
        group_id VARCHAR(500),
        group_name VARCHAR(255),
        headers JSONB NOT NULL DEFAULT '[]',
        rows JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_reference_tables_user_id  ON reference_tables(user_id);
      CREATE INDEX IF NOT EXISTS idx_reference_tables_group_id ON reference_tables(group_id);
    `);

    // Создать admin если нет
    const admin = await pool.query('SELECT id FROM users WHERE username = $1', ['admin']);
    if (admin.rows.length === 0) {
      const hash = await bcrypt.hash('admin123', 10);
      await pool.query(
        'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)',
        ['admin', hash, 'admin']
      );
      console.log('✅ Создана учётная запись admin / admin123');
    }

    console.log('✅ БД инициализирована');
  } catch (err) {
    console.error('❌ Ошибка инициализации БД:', err.message);
    process.exit(1);
  }
};

// ═══════════════════════════════════════════════════════════════
// АВТОРИЗАЦИЯ
// ═══════════════════════════════════════════════════════════════

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Укажите логин и пароль' });
    if (username.length < 3 || password.length < 6)
      return res.status(400).json({ error: 'Логин минимум 3 символа, пароль минимум 6' });

    const safe = sanitizeInput(username.trim());
    const exists = await pool.query('SELECT id FROM users WHERE username = $1', [safe]);
    if (exists.rows.length > 0)
      return res.status(400).json({ error: 'Пользователь уже существует' });

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role',
      [safe, hash, 'engineer']
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({ message: 'Регистрация успешна', token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Укажите логин и пароль' });

    const safe = sanitizeInput(username.trim());
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [safe]);
    if (result.rows.length === 0)
      return res.status(401).json({ error: 'Неверный логин или пароль' });

    const user = result.rows[0];
    if (!await bcrypt.compare(password, user.password_hash))
      return res.status(401).json({ error: 'Неверный логин или пароль' });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ message: 'Успешный вход', token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ═══════════════════════════════════════════════════════════════
// УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ (только admin)
// ═══════════════════════════════════════════════════════════════

app.get('/api/admin/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });
  try {
    const result = await pool.query('SELECT id, username, role, created_at FROM users ORDER BY created_at ASC');
    res.json({ users: result.rows });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.post('/api/admin/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });
  try {
    const { username, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Укажите логин и пароль' });
    if (!['admin', 'engineer'].includes(role)) return res.status(400).json({ error: 'Недопустимая роль' });
    if (username.length < 3 || password.length < 6)
      return res.status(400).json({ error: 'Логин минимум 3 символа, пароль минимум 6' });
    const safe = sanitizeInput(username.trim());
    const exists = await pool.query('SELECT id FROM users WHERE username=$1', [safe]);
    if (exists.rows.length) return res.status(400).json({ error: 'Пользователь уже существует' });
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, role) VALUES ($1,$2,$3) RETURNING id, username, role',
      [safe, hash, role]
    );
    res.status(201).json({ user: result.rows[0] });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.put('/api/admin/users/:id/role', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });
  if (req.user.id === req.params.id) return res.status(403).json({ error: 'Нельзя изменить свою роль' });
  try {
    const { role } = req.body;
    if (!['admin', 'engineer'].includes(role)) return res.status(400).json({ error: 'Недопустимая роль' });
    if (!isUUID(req.params.id)) return res.status(400).json({ error: 'Некорректный ID' });
    const result = await pool.query(
      'UPDATE users SET role=$1 WHERE id=$2 RETURNING id, username, role',
      [role, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json({ user: result.rows[0] });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// ═══════════════════════════════════════════════════════════════
// РАСЧЁТЫ
// ═══════════════════════════════════════════════════════════════

app.post('/api/calculate', authenticateToken, async (req, res) => {
  try {
    calculationEngine.validateInput(req.body);
    const result = calculationEngine.calculateEvaporatorBattery(req.body);
    res.json({ success: true, result });
  } catch (err) {
    res.status(err.isValidation ? 400 : 500).json({ error: err.message });
  }
});

app.post('/api/calculate/optimize', authenticateToken, async (req, res) => {
  try {
    calculationEngine.validateInput({ ...req.body, numberOfEffects: 1 });
    const result = calculationEngine.optimizeNumberOfEffects(req.body);
    res.json({ success: true, result });
  } catch (err) {
    res.status(err.isValidation ? 400 : 500).json({ error: err.message });
  }
});

app.post('/api/calculations', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { name, input, result } = req.body;
    if (!name || !input || !result)
      return res.status(400).json({ error: 'name, input и result обязательны' });

    const proj = await client.query(
      `INSERT INTO calculation_projects
         (user_id, name, evaporator_type, flow_direction, number_of_effects,
          feed_flow_rate, initial_concentration, final_concentration,
          input_json, result_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.user.id, name, input.evaporatorType, input.flowDirection,
       input.numberOfEffects, input.feedFlowRate, input.initialConcentration,
       input.finalConcentration, JSON.stringify(input), JSON.stringify(result)]
    );

    for (const s of result.stages) {
      await client.query(
        `INSERT INTO calculation_results
           (project_id,stage_number,temperature,pressure,feed_flow_rate,
            evaporated_water,concentration_in,concentration_out,
            steam_consumption,heat_exchange_area,heat_load)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [proj.rows[0].id, s.stageNumber, s.temperature, s.pressure,
         s.feedFlowRate, s.evaporatedWater, s.concentrationIn, s.concentrationOut,
         s.steamConsumption, s.heatExchangeArea, s.heatLoad]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, projectId: proj.rows[0].id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Ошибка сохранения проекта' });
  } finally {
    client.release();
  }
});

app.get('/api/calculations', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cp.*, COUNT(cr.id) as stages_count
       FROM calculation_projects cp
       LEFT JOIN calculation_results cr ON cp.id = cr.project_id
       WHERE cp.user_id = $1
       GROUP BY cp.id ORDER BY cp.updated_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, calculations: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения проектов' });
  }
});

const buildCalculation = (project, stages) => {
  const input = project.input_json || {
    evaporatorType: project.evaporator_type,
    flowDirection: project.flow_direction,
    numberOfEffects: project.number_of_effects,
    feedFlowRate: parseFloat(project.feed_flow_rate),
    initialConcentration: parseFloat(project.initial_concentration),
    finalConcentration: parseFloat(project.final_concentration),
    steamTemperature: project.steam_temperature ? parseFloat(project.steam_temperature) : undefined,
    heatTransferCoefficient: project.heat_transfer_coefficient ? parseFloat(project.heat_transfer_coefficient) : undefined,
  };
  const resultJson = project.result_json;
  if (resultJson) {
    return { id: project.id, name: project.name, createdAt: project.created_at, updatedAt: project.updated_at, ...resultJson, input };
  }
  const st = stages.map(r => ({
    stageNumber: r.stage_number,
    temperature: parseFloat(r.temperature),
    pressure: parseFloat(r.pressure),
    feedFlowRate: parseFloat(r.feed_flow_rate),
    evaporatedWater: parseFloat(r.evaporated_water),
    concentrationIn: parseFloat(r.concentration_in),
    concentrationOut: parseFloat(r.concentration_out),
    steamConsumption: parseFloat(r.steam_consumption),
    heatExchangeArea: parseFloat(r.heat_exchange_area),
    heatLoad: parseFloat(r.heat_load)
  }));
  const totalW = st.reduce((s, r) => s + r.evaporatedWater, 0);
  const totalD = st.reduce((s, r) => s + r.steamConsumption, 0);
  const totalF = st.reduce((s, r) => s + r.heatExchangeArea, 0);
  return {
    id: project.id, name: project.name,
    createdAt: project.created_at, updatedAt: project.updated_at,
    input, stages: st,
    totalEvaporatedWater: totalW,
    totalSteamConsumption: totalD,
    steamEconomy: totalW / totalD,
    totalHeatExchangeArea: totalF,
    averageHeatExchangeArea: totalF / st.length
  };
};

app.get('/api/calculations/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUUID(id)) return res.status(400).json({ error: 'Некорректный ID' });
    const proj = await pool.query('SELECT * FROM calculation_projects WHERE id=$1 AND user_id=$2', [id, req.user.id]);
    if (!proj.rows.length) return res.status(404).json({ error: 'Проект не найден' });
    const stages = await pool.query('SELECT * FROM calculation_results WHERE project_id=$1 ORDER BY stage_number', [id]);
    res.json({ success: true, calculation: buildCalculation(proj.rows[0], stages.rows) });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения проекта' });
  }
});

app.delete('/api/calculations/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUUID(id)) return res.status(400).json({ error: 'Некорректный ID' });
    const result = await pool.query('DELETE FROM calculation_projects WHERE id=$1 AND user_id=$2 RETURNING id', [id, req.user.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Проект не найден' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка удаления' });
  }
});

// Экспорт PDF / Excel
const getCalculationData = async (id, userId) => {
  const proj = await pool.query('SELECT * FROM calculation_projects WHERE id=$1 AND user_id=$2', [id, userId]);
  if (!proj.rows.length) return null;
  const stages = await pool.query('SELECT * FROM calculation_results WHERE project_id=$1 ORDER BY stage_number', [id]);
  return buildCalculation(proj.rows[0], stages.rows);
};

app.get('/api/calculations/:id/export/pdf', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUUID(id)) return res.status(400).json({ error: 'Некорректный ID' });
    const data = await getCalculationData(id, req.user.id);
    if (!data) return res.status(404).json({ error: 'Проект не найден' });
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    const file = path.join(tempDir, `report_${id}_${Date.now()}.pdf`);
    await reportGenerator.generatePDFReport(data, file);
    res.download(file, path.basename(file), () => fs.existsSync(file) && fs.unlinkSync(file));
  } catch (err) {
    res.status(500).json({ error: 'Ошибка экспорта PDF' });
  }
});

app.get('/api/calculations/:id/export/excel', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUUID(id)) return res.status(400).json({ error: 'Некорректный ID' });
    const data = await getCalculationData(id, req.user.id);
    if (!data) return res.status(404).json({ error: 'Проект не найден' });
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    const file = path.join(tempDir, `report_${id}_${Date.now()}.xlsx`);
    reportGenerator.generateExcelReport(data, file);
    res.download(file, path.basename(file), () => fs.existsSync(file) && fs.unlinkSync(file));
  } catch (err) {
    res.status(500).json({ error: 'Ошибка экспорта Excel' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ТОВАРЫ
// ═══════════════════════════════════════════════════════════════

app.get('/api/products', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = 'SELECT * FROM products', params = [], conds = [];
    if (category) { conds.push(`category = $${params.length+1}`); params.push(sanitizeInput(category)); }
    if (search)   { conds.push(`(name ILIKE $${params.length+1} OR description ILIKE $${params.length+1})`); params.push(`%${sanitizeInput(search)}%`); }
    if (conds.length) query += ' WHERE ' + conds.join(' AND ');
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUUID(id)) return res.status(400).json({ error: 'Некорректный ID' });
    const result = await pool.query('SELECT * FROM products WHERE id=$1', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Товар не найден' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });
    const { name, description, price, image, category } = req.body;
    const errors = validateProductData({ name, description, price, category });
    if (errors.length) return res.status(400).json({ error: errors.join(', ') });
    if (!name || price === undefined) return res.status(400).json({ error: 'name и price обязательны' });
    const result = await pool.query(
      'INSERT INTO products (name,description,price,image,category) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [sanitizeInput(name.trim()), sanitizeInput(description?.trim()||''), price, sanitizeInput(image?.trim()||''), sanitizeInput(category?.trim()||'')]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.put('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });
    const { id } = req.params;
    if (!isUUID(id)) return res.status(400).json({ error: 'Некорректный ID' });
    const { name, description, price, image, category } = req.body;
    const errors = validateProductData({ name, description, price, category });
    if (errors.length) return res.status(400).json({ error: errors.join(', ') });
    const result = await pool.query(
      `UPDATE products SET
         name=COALESCE($1,name), description=COALESCE($2,description),
         price=COALESCE($3,price), image=COALESCE($4,image), category=COALESCE($5,category)
       WHERE id=$6 RETURNING *`,
      [name?sanitizeInput(name.trim()):null, description?sanitizeInput(description.trim()):null,
       price, image?sanitizeInput(image.trim()):null, category?sanitizeInput(category.trim()):null, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Товар не найден' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });
    const { id } = req.params;
    if (!isUUID(id)) return res.status(400).json({ error: 'Некорректный ID' });
    const result = await pool.query('DELETE FROM products WHERE id=$1 RETURNING *', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Товар не найден' });
    res.json({ message: 'Товар удалён', product: result.rows[0] });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// ═══════════════════════════════════════════════════════════════
// СПРАВОЧНЫЕ ТАБЛИЦЫ
// ═══════════════════════════════════════════════════════════════

// Переименовать группу
app.put('/api/reference/tables/group/:groupId/name', authenticateToken, async (req, res) => {
  try {
    const { group_name } = req.body;
    if (!group_name) return res.status(400).json({ error: 'group_name обязателен' });
    await pool.query(
      `UPDATE reference_tables SET group_name=$1, updated_at=NOW()
       WHERE group_id=$2 AND user_id=$3`,
      [group_name, req.params.groupId, req.user.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Ошибка переименования группы' }); }
});

// Batch-импорт всех листов
app.post('/api/reference/tables/batch', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { group_id, group_name, tables } = req.body;
    if (!group_id || !Array.isArray(tables) || !tables.length)
      return res.status(400).json({ error: 'group_id и tables обязательны' });

    const created = [];
    for (const t of tables) {
      const result = await client.query(
        `INSERT INTO reference_tables (user_id,name,group_id,group_name,headers,rows)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [req.user.id, t.name, group_id, group_name || '', JSON.stringify(t.headers), JSON.stringify(t.rows)]
      );
      created.push(result.rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, tables: created.map(mapTable) });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Ошибка batch-импорта' });
  } finally {
    client.release();
  }
});

// Создать таблицу
app.post('/api/reference/tables', authenticateToken, async (req, res) => {
  try {
    const { name, headers, rows } = req.body;
    if (!name || !headers || !rows)
      return res.status(400).json({ error: 'name, headers и rows обязательны' });
    const result = await pool.query(
      `INSERT INTO reference_tables (user_id,name,headers,rows)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.user.id, name, JSON.stringify(headers), JSON.stringify(rows)]
    );
    res.status(201).json({ success: true, table: mapTable(result.rows[0]) });
  } catch (err) { res.status(500).json({ error: 'Ошибка сохранения таблицы' }); }
});

// Получить все таблицы
app.get('/api/reference/tables', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM reference_tables WHERE user_id=$1 ORDER BY updated_at DESC',
      [req.user.id]
    );
    res.json({ success: true, tables: result.rows.map(mapTable) });
  } catch (err) { res.status(500).json({ error: 'Ошибка получения таблиц' }); }
});

// Получить таблицу по ID
app.get('/api/reference/tables/:id', authenticateToken, async (req, res) => {
  try {
    if (!isUUID(req.params.id)) return res.status(400).json({ error: 'Некорректный ID' });
    const result = await pool.query(
      'SELECT * FROM reference_tables WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Таблица не найдена' });
    res.json({ success: true, table: mapTable(result.rows[0]) });
  } catch (err) { res.status(500).json({ error: 'Ошибка получения таблицы' }); }
});

// Обновить таблицу
app.put('/api/reference/tables/:id', authenticateToken, async (req, res) => {
  try {
    if (!isUUID(req.params.id)) return res.status(400).json({ error: 'Некорректный ID' });
    const { name, headers, rows } = req.body;
    const result = await pool.query(
      `UPDATE reference_tables SET name=$1, headers=$2, rows=$3, updated_at=NOW()
       WHERE id=$4 AND user_id=$5 RETURNING *`,
      [name, JSON.stringify(headers), JSON.stringify(rows), req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Таблица не найдена' });
    res.json({ success: true, table: mapTable(result.rows[0]) });
  } catch (err) { res.status(500).json({ error: 'Ошибка обновления таблицы' }); }
});

// Удалить таблицу
app.delete('/api/reference/tables/:id', authenticateToken, async (req, res) => {
  try {
    if (!isUUID(req.params.id)) return res.status(400).json({ error: 'Некорректный ID' });
    const result = await pool.query(
      'DELETE FROM reference_tables WHERE id=$1 AND user_id=$2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Таблица не найдена' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Ошибка удаления таблицы' }); }
});

// Маппинг: JSONB из PG → JS массивы
const mapTable = (row) => ({
  id:         row.id,
  name:       row.name,
  group_id:   row.group_id   || null,
  group_name: row.group_name || null,
  headers:    Array.isArray(row.headers) ? row.headers : JSON.parse(row.headers || '[]'),
  rows:       Array.isArray(row.rows)    ? row.rows    : JSON.parse(row.rows    || '[]'),
  created_at: row.created_at,
  updated_at: row.updated_at
});

// ═══════════════════════════════════════════════════════════════
app.listen(PORT, async () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  await initDB();
});
