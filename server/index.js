/**
 * Упрощённый сервер с in-memory базой данных
 * Для разработки и демонстрации без PostgreSQL
 */

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const calculationEngine = require('./calculationEngine');
const reportGenerator = require('./reportGenerator');
const inMemoryDB = require('./inMemoryDB');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

app.use(cors());
app.use(express.json());

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

    const userExists = await inMemoryDB.users.findByUsername(username.trim());
    if (userExists) {
      return res.status(400).json({ error: 'Пользователь уже существует' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await inMemoryDB.users.create(username.trim(), hashedPassword, 'engineer');

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Регистрация успешна',
      token,
      user: { id: user.id, username: user.username, role: user.role }
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

    const user = await inMemoryDB.users.findByUsername(username.trim());
    if (!user) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

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
    const user = await inMemoryDB.users.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    res.json({ user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    console.error('Ошибка получения профиля:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// === ЭНДПОИНТЫ УПРАВЛЕНИЯ ПОЛЬЗОВАТЕЛЯМИ (только админ) ===

// Получить всех пользователей
app.get('/api/admin/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ только для администраторов' });
  }
  try {
    const allUsers = await inMemoryDB.users.findAll();
    res.json({ users: allUsers.map(u => ({ id: u.id, username: u.username, role: u.role, created_at: u.created_at })) });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создать пользователя
app.post('/api/admin/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ только для администраторов' });
  }
  try {
    const { username, password, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Укажите логин и пароль' });
    }
    if (!['admin', 'engineer'].includes(role)) {
      return res.status(400).json({ error: 'Недопустимая роль' });
    }
    if (username.length < 3 || password.length < 6) {
      return res.status(400).json({ error: 'Логин минимум 3 символа, пароль минимум 6' });
    }
    const exists = await inMemoryDB.users.findByUsername(username.trim());
    if (exists) {
      return res.status(400).json({ error: 'Пользователь уже существует' });
    }
    const hash = await bcrypt.hash(password, 10);
    const user = await inMemoryDB.users.create(username.trim(), hash, role);
    res.status(201).json({ user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Изменить роль пользователя (нельзя изменить свою роль)
app.put('/api/admin/users/:id/role', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ только для администраторов' });
  }
  if (req.user.id === req.params.id) {
    return res.status(403).json({ error: 'Нельзя изменить свою роль' });
  }
  try {
    const { role } = req.body;
    if (!['admin', 'engineer'].includes(role)) {
      return res.status(400).json({ error: 'Недопустимая роль' });
    }
    const user = await inMemoryDB.users.updateRole(req.params.id, role);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json({ user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// === ЭНДПОИНТЫ РАСЧЁТА ВЫПАРНЫХ БАТАРЕЙ ===

// Выполнить расчёт батареи (без сохранения)
app.post('/api/calculate', authenticateToken, async (req, res) => {
  try {
    const input = req.body;
    
    // Валидация входных данных
    try {
      calculationEngine.validateInput(input);
    } catch (validationError) {
      return res.status(400).json({ error: validationError.message });
    }
    
    // Выполнение расчёта
    const result = calculationEngine.calculateEvaporatorBattery(input);
    
    res.json({ success: true, result });
  } catch (err) {
    console.error('Ошибка расчёта:', err);
    res.status(500).json({ error: 'Ошибка при выполнении расчёта' });
  }
});

// Оптимизация количества корпусов
app.post('/api/calculate/optimize', authenticateToken, async (req, res) => {
  try {
    const input = req.body;
    
    // Валидация
    try {
      calculationEngine.validateInput({ ...input, numberOfEffects: 1 });
    } catch (validationError) {
      return res.status(400).json({ error: validationError.message });
    }
    
    // Оптимизация
    const optimizationResult = calculationEngine.optimizeNumberOfEffects(input);
    
    res.json({ success: true, result: optimizationResult });
  } catch (err) {
    console.error('Ошибка оптимизации:', err);
    res.status(500).json({ error: 'Ошибка при оптимизации' });
  }
});

// Сохранить проект расчёта
app.post('/api/calculations', authenticateToken, async (req, res) => {
  try {
    const { name, input, result } = req.body;
    
    if (!name || !input || !result) {
      return res.status(400).json({ error: 'Название, параметры и результаты обязательны' });
    }
    
    // Сохранение проекта
    const project = await inMemoryDB.calculationProjects.create(req.user.id, {
      name,
      evaporatorType: input.evaporatorType,
      flowDirection: input.flowDirection,
      numberOfEffects: input.numberOfEffects,
      feedFlowRate: input.feedFlowRate,
      initialConcentration: input.initialConcentration,
      finalConcentration: input.finalConcentration,
      steamTemperature: input.steamTemperature,
      heatTransferCoefficient: input.heatTransferCoefficient,
      vaporizationHeat: input.vaporizationHeat,
      condensationHeat: input.condensationHeat,
      pressureLoss: input.pressureLoss || null,
      vacuumPressure: input.vacuumPressure || null
    });
    
    // Сохранение результатов по корпусам
    for (const stage of result.stages) {
      await inMemoryDB.calculationResults.create(project.id, {
        stageNumber: stage.stageNumber,
        temperature: stage.temperature,
        pressure: stage.pressure,
        feedFlowRate: stage.feedFlowRate,
        evaporatedWater: stage.evaporatedWater,
        concentrationIn: stage.concentrationIn,
        concentrationOut: stage.concentrationOut,
        steamConsumption: stage.steamConsumption,
        heatExchangeArea: stage.heatExchangeArea,
        heatLoad: stage.heatLoad
      });
    }
    
    res.status(201).json({
      success: true,
      projectId: project.id,
      message: 'Проект сохранён'
    });
  } catch (err) {
    console.error('Ошибка сохранения проекта:', err);
    res.status(500).json({ error: 'Ошибка при сохранении проекта' });
  }
});

// Получить все проекты пользователя
app.get('/api/calculations', authenticateToken, async (req, res) => {
  try {
    const projects = await inMemoryDB.calculationProjects.findAllByUser(req.user.id);
    
    // Добавляем количество этапов к каждому проекту
    const calculations = await Promise.all(projects.map(async (project) => {
      const stagesCount = await inMemoryDB.calculationResults.countByProjectId(project.id);
      return {
        ...project,
        stages_count: stagesCount
      };
    }));
    
    res.json({ success: true, calculations });
  } catch (err) {
    console.error('Ошибка получения проектов:', err);
    res.status(500).json({ error: 'Ошибка при получении проектов' });
  }
});

// Получить проект по ID
app.get('/api/calculations/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Получение проекта
    const project = await inMemoryDB.calculationProjects.findById(id, req.user.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Проект не найден' });
    }
    
    // Получение результатов по корпусам
    const stages = await inMemoryDB.calculationResults.findByProjectId(id);
    
    const input = {
      evaporatorType: project.evaporator_type,
      flowDirection: project.flow_direction,
      numberOfEffects: project.number_of_effects,
      feedFlowRate: parseFloat(project.feed_flow_rate),
      initialConcentration: parseFloat(project.initial_concentration),
      finalConcentration: parseFloat(project.final_concentration),
      steamTemperature: parseFloat(project.steam_temperature),
      heatTransferCoefficient: parseFloat(project.heat_transfer_coefficient),
      vaporizationHeat: parseFloat(project.vaporization_heat),
      condensationHeat: parseFloat(project.condensation_heat),
      pressureLoss: project.pressure_loss ? parseFloat(project.pressure_loss) : undefined,
      vacuumPressure: project.vacuum_pressure ? parseFloat(project.vacuum_pressure) : undefined
    };
    
    const stageResults = stages.map(row => ({
      stageNumber: row.stage_number,
      temperature: parseFloat(row.temperature),
      pressure: parseFloat(row.pressure),
      feedFlowRate: parseFloat(row.feed_flow_rate),
      evaporatedWater: parseFloat(row.evaporated_water),
      concentrationIn: parseFloat(row.concentration_in),
      concentrationOut: parseFloat(row.concentration_out),
      steamConsumption: parseFloat(row.steam_consumption),
      heatExchangeArea: parseFloat(row.heat_exchange_area),
      heatLoad: parseFloat(row.heat_load)
    }));
    
    // Расчёт сводных данных
    const totalEvaporatedWater = stageResults.reduce((sum, s) => sum + s.evaporatedWater, 0);
    const totalSteamConsumption = stageResults.reduce((sum, s) => sum + s.steamConsumption, 0);
    const totalHeatExchangeArea = stageResults.reduce((sum, s) => sum + s.heatExchangeArea, 0);
    
    res.json({
      success: true,
      calculation: {
        id: project.id,
        name: project.name,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
        input,
        stages: stageResults,
        totalEvaporatedWater,
        totalSteamConsumption,
        steamEconomy: totalEvaporatedWater / totalSteamConsumption,
        totalHeatExchangeArea,
        averageHeatExchangeArea: totalHeatExchangeArea / stageResults.length
      }
    });
  } catch (err) {
    console.error('Ошибка получения проекта:', err);
    res.status(500).json({ error: 'Ошибка при получении проекта' });
  }
});

// Удалить проект
app.delete('/api/calculations/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await inMemoryDB.calculationProjects.delete(id, req.user.id);
    
    if (!result) {
      return res.status(404).json({ error: 'Проект не найден' });
    }
    
    res.json({ success: true, message: 'Проект удалён' });
  } catch (err) {
    console.error('Ошибка удаления проекта:', err);
    res.status(500).json({ error: 'Ошибка при удалении проекта' });
  }
});

// Экспорт в PDF
app.get('/api/calculations/:id/export/pdf', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Получение проекта
    const project = await inMemoryDB.calculationProjects.findById(id, req.user.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Проект не найден' });
    }
    
    // Получение результатов по корпусам
    const stages = await inMemoryDB.calculationResults.findByProjectId(id);
    
    const input = {
      evaporatorType: project.evaporator_type,
      flowDirection: project.flow_direction,
      numberOfEffects: project.number_of_effects,
      feedFlowRate: parseFloat(project.feed_flow_rate),
      initialConcentration: parseFloat(project.initial_concentration),
      finalConcentration: parseFloat(project.final_concentration),
      steamTemperature: parseFloat(project.steam_temperature),
      heatTransferCoefficient: parseFloat(project.heat_transfer_coefficient),
      vaporizationHeat: parseFloat(project.vaporization_heat),
      condensationHeat: parseFloat(project.condensation_heat),
      pressureLoss: project.pressure_loss ? parseFloat(project.pressure_loss) : undefined,
      vacuumPressure: project.vacuum_pressure ? parseFloat(project.vacuum_pressure) : undefined
    };
    
    const stageResults = stages.map(row => ({
      stageNumber: row.stage_number,
      temperature: parseFloat(row.temperature),
      pressure: parseFloat(row.pressure),
      feedFlowRate: parseFloat(row.feed_flow_rate),
      evaporatedWater: parseFloat(row.evaporated_water),
      concentrationIn: parseFloat(row.concentration_in),
      concentrationOut: parseFloat(row.concentration_out),
      steamConsumption: parseFloat(row.steam_consumption),
      heatExchangeArea: parseFloat(row.heat_exchange_area),
      heatLoad: parseFloat(row.heat_load)
    }));
    
    // Расчёт сводных данных
    const totalEvaporatedWater = stageResults.reduce((sum, s) => sum + s.evaporatedWater, 0);
    const totalSteamConsumption = stageResults.reduce((sum, s) => sum + s.steamConsumption, 0);
    const totalHeatExchangeArea = stageResults.reduce((sum, s) => sum + s.heatExchangeArea, 0);
    
    const calculationData = {
      input,
      stages: stageResults,
      totalEvaporatedWater,
      totalSteamConsumption,
      steamEconomy: totalEvaporatedWater / totalSteamConsumption,
      totalHeatExchangeArea,
      averageHeatExchangeArea: totalHeatExchangeArea / stageResults.length
    };
    
    // Генерация PDF
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
    
    const fileName = `report_${id}_${Date.now()}.pdf`;
    const outputPath = path.join(tempDir, fileName);
    
    await reportGenerator.generatePDFReport(calculationData, outputPath);
    
    // Отправка файла
    res.download(outputPath, fileName, (err) => {
      if (!err) {
        // Удаление временного файла после отправки
        fs.unlinkSync(outputPath);
      }
    });
  } catch (err) {
    console.error('Ошибка экспорта в PDF:', err);
    res.status(500).json({ error: 'Ошибка при экспорте в PDF' });
  }
});

// Экспорт в Excel
app.get('/api/calculations/:id/export/excel', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Получение проекта
    const project = await inMemoryDB.calculationProjects.findById(id, req.user.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Проект не найден' });
    }
    
    // Получение результатов по корпусам
    const stages = await inMemoryDB.calculationResults.findByProjectId(id);
    
    const input = {
      evaporatorType: project.evaporator_type,
      flowDirection: project.flow_direction,
      numberOfEffects: project.number_of_effects,
      feedFlowRate: parseFloat(project.feed_flow_rate),
      initialConcentration: parseFloat(project.initial_concentration),
      finalConcentration: parseFloat(project.final_concentration),
      steamTemperature: parseFloat(project.steam_temperature),
      heatTransferCoefficient: parseFloat(project.heat_transfer_coefficient),
      vaporizationHeat: parseFloat(project.vaporization_heat),
      condensationHeat: parseFloat(project.condensation_heat),
      pressureLoss: project.pressure_loss ? parseFloat(project.pressure_loss) : undefined,
      vacuumPressure: project.vacuum_pressure ? parseFloat(project.vacuum_pressure) : undefined
    };
    
    const stageResults = stages.map(row => ({
      stageNumber: row.stage_number,
      temperature: parseFloat(row.temperature),
      pressure: parseFloat(row.pressure),
      feedFlowRate: parseFloat(row.feed_flow_rate),
      evaporatedWater: parseFloat(row.evaporated_water),
      concentrationIn: parseFloat(row.concentration_in),
      concentrationOut: parseFloat(row.concentration_out),
      steamConsumption: parseFloat(row.steam_consumption),
      heatExchangeArea: parseFloat(row.heat_exchange_area),
      heatLoad: parseFloat(row.heat_load)
    }));
    
    // Расчёт сводных данных
    const totalEvaporatedWater = stageResults.reduce((sum, s) => sum + s.evaporatedWater, 0);
    const totalSteamConsumption = stageResults.reduce((sum, s) => sum + s.steamConsumption, 0);
    const totalHeatExchangeArea = stageResults.reduce((sum, s) => sum + s.heatExchangeArea, 0);
    
    const calculationData = {
      input,
      stages: stageResults,
      totalEvaporatedWater,
      totalSteamConsumption,
      steamEconomy: totalEvaporatedWater / totalSteamConsumption,
      totalHeatExchangeArea,
      averageHeatExchangeArea: totalHeatExchangeArea / stageResults.length
    };
    
    // Генерация Excel
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
    
    const fileName = `report_${id}_${Date.now()}.xlsx`;
    const outputPath = path.join(tempDir, fileName);
    
    reportGenerator.generateExcelReport(calculationData, outputPath);
    
    // Отправка файла
    res.download(outputPath, fileName, (err) => {
      if (!err) {
        // Удаление временного файла после отправки
        fs.unlinkSync(outputPath);
      }
    });
  } catch (err) {
    console.error('Ошибка экспорта в Excel:', err);
    res.status(500).json({ error: 'Ошибка при экспорте в Excel' });
  }
});

// === ЭНДПОИНТЫ СПРАВОЧНЫХ ТАБЛИЦ ===

// Переименовать группу
app.put('/api/reference/tables/group/:groupId/name', authenticateToken, async (req, res) => {
  try {
    const { group_name } = req.body;
    if (!group_name) return res.status(400).json({ error: 'group_name обязателен' });
    await inMemoryDB.referenceTables.renameGroup(req.params.groupId, req.user.id, group_name);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка переименования группы' });
  }
});

// Batch-импорт (все листы из одного файла)
app.post('/api/reference/tables/batch', authenticateToken, async (req, res) => {
  try {
    const { group_id, group_name, tables } = req.body;
    if (!group_id || !Array.isArray(tables) || tables.length === 0) {
      return res.status(400).json({ error: 'group_id и tables обязательны' });
    }
    const created = await inMemoryDB.referenceTables.createBatch(req.user.id, group_id, group_name || '', tables);
    res.status(201).json({ success: true, tables: created });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка batch-импорта' });
  }
});

// Сохранить таблицу
app.post('/api/reference/tables', authenticateToken, async (req, res) => {
  try {
    const { name, headers, rows } = req.body;
    if (!name || !headers || !rows) {
      return res.status(400).json({ error: 'name, headers и rows обязательны' });
    }
    const table = await inMemoryDB.referenceTables.create(req.user.id, { name, headers, rows });
    res.status(201).json({ success: true, table });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сохранения таблицы' });
  }
});

// Получить все таблицы пользователя
app.get('/api/reference/tables', authenticateToken, async (req, res) => {
  try {
    const tables = await inMemoryDB.referenceTables.findAll(req.user.id);
    res.json({ success: true, tables });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения таблиц' });
  }
});

// Получить таблицу по ID
app.get('/api/reference/tables/:id', authenticateToken, async (req, res) => {
  try {
    const table = await inMemoryDB.referenceTables.findById(req.params.id, req.user.id);
    if (!table) return res.status(404).json({ error: 'Таблица не найдена' });
    res.json({ success: true, table });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения таблицы' });
  }
});

// Обновить таблицу (после ручного редактирования)
app.put('/api/reference/tables/:id', authenticateToken, async (req, res) => {
  try {
    const { name, headers, rows } = req.body;
    const table = await inMemoryDB.referenceTables.update(req.params.id, req.user.id, { name, headers, rows });
    if (!table) return res.status(404).json({ error: 'Таблица не найдена' });
    res.json({ success: true, table });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка обновления таблицы' });
  }
});

// Удалить таблицу
app.delete('/api/reference/tables/:id', authenticateToken, async (req, res) => {
  try {
    const result = await inMemoryDB.referenceTables.delete(req.params.id, req.user.id);
    if (!result) return res.status(404).json({ error: 'Таблица не найдена' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка удаления таблицы' });
  }
});

// === ЭНДПОИНТЫ ПРОДУКТОВ ===

// Получить все продукты (публичный)
app.get('/api/products', async (req, res) => {
  try {
    const { category, search } = req.query;
    
    const filters = {};
    if (category) filters.category = category;
    if (search) filters.search = search;
    
    const result = await inMemoryDB.products.findAll(filters);
    res.json(result);
  } catch (err) {
    console.error('Ошибка получения продуктов:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить продукт по ID (публичный)
app.get('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await inMemoryDB.products.findById(id);
    
    if (!result) {
      return res.status(404).json({ error: 'Продукт не найден' });
    }
    
    res.json(result);
  } catch (err) {
    console.error('Ошибка получения продукта:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создать продукт (только админ)
app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Доступ только для администраторов' });
    }

    const { name, description, price, image, category } = req.body;
    
    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Название и цена обязательны' });
    }

    const result = await inMemoryDB.products.create({
      name: name.trim(),
      description: description?.trim() || '',
      price,
      image: image?.trim() || '',
      category: category?.trim() || ''
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('Ошибка создания продукта:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Обновить продукт (только админ)
app.put('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Доступ только для администраторов' });
    }

    const { id } = req.params;
    const { name, description, price, image, category } = req.body;

    const existing = await inMemoryDB.products.findById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Продукт не найден' });
    }

    const result = await inMemoryDB.products.update(id, {
      name: name ? name.trim() : existing.name,
      description: description ? description.trim() : existing.description,
      price: price !== undefined ? price : existing.price,
      image: image ? image.trim() : existing.image,
      category: category ? category.trim() : existing.category
    });

    res.json(result);
  } catch (err) {
    console.error('Ошибка обновления продукта:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Удалить продукт (только админ)
app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Доступ только для администраторов' });
    }

    const { id } = req.params;
    
    const result = await inMemoryDB.products.delete(id);

    if (!result) {
      return res.status(404).json({ error: 'Продукт не найден' });
    }

    res.json({ message: 'Продукт удален', product: result });
  } catch (err) {
    console.error('Ошибка удаления продукта:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', async () => {
  const os = require('os');
  const lanIP = Object.values(os.networkInterfaces())
    .flat().find(i => i.family === 'IPv4' && !i.internal)?.address || 'unknown';
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📍 Локально:  http://localhost:${PORT}`);
  console.log(`🌐 В сети:    http://${lanIP}:${PORT}`);
  await inMemoryDB.initDB();
  console.log('✅ Сервер готов к работе');
});
