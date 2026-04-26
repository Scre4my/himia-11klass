/**
 * In-memory хранилище для замены PostgreSQL во время разработки/тестирования
 * Имитирует основные функции базы данных
 */

const crypto = require('crypto');

// Генерация UUID
const generateUUID = () => {
  return crypto.randomUUID();
};

// Хранилище данных
const db = {
  users: [],
  products: [],
  calculation_projects: [],
  calculation_results: [],
  reference_tables: []
};

// Инициализация БД (создание дефолтных данных)
const initDB = () => {
  console.log('✅ Инициализация in-memory базы данных');
  
  // Создаем админскую учетку если её нет
  const adminExists = db.users.find(u => u.username === 'admin');
  if (!adminExists) {
    const bcrypt = require('bcryptjs');
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.users.push({
      id: generateUUID(),
      username: 'admin',
      password_hash: hashedPassword,
      role: 'admin',
      created_at: new Date().toISOString()
    });
    console.log('✅ Создана учетная запись администратора (admin/admin123)');
  }
  
  console.log(`✅ In-memory БД инициализирована (${db.users.length} пользователей, ${db.products.length} продуктов)`);
};

// Функции для работы с пользователями
const users = {
  // Создать пользователя
  create: async (username, password_hash, role = 'engineer') => {
    const user = {
      id: generateUUID(),
      username,
      password_hash,
      role,
      created_at: new Date().toISOString()
    };
    db.users.push(user);
    return user;
  },
  
  // Найти пользователя по username
  findByUsername: async (username) => {
    return db.users.find(u => u.username === username);
  },
  
  // Найти пользователя по ID
  findById: async (id) => {
    return db.users.find(u => u.id === id);
  },
  
  // Получить всех пользователей
  findAll: async () => {
    return db.users;
  },

  // Обновить роль пользователя
  updateRole: async (id, role) => {
    const user = db.users.find(u => u.id === id);
    if (!user) return null;
    user.role = role;
    return user;
  }
};

// Функции для работы с продуктами
const products = {
  create: async (data) => {
    const product = {
      id: generateUUID(),
      name: data.name,
      description: data.description || '',
      price: data.price,
      image: data.image || '',
      category: data.category || '',
      created_at: new Date().toISOString()
    };
    db.products.push(product);
    return product;
  },
  
  findById: async (id) => {
    return db.products.find(p => p.id === id);
  },
  
  findAll: async (filters = {}) => {
    let result = [...db.products];
    
    if (filters.category) {
      result = result.filter(p => p.category === filters.category);
    }
    
    if (filters.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(search) || 
        (p.description && p.description.toLowerCase().includes(search))
      );
    }
    
    return result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },
  
  update: async (id, data) => {
    const index = db.products.findIndex(p => p.id === id);
    if (index === -1) return null;
    
    db.products[index] = {
      ...db.products[index],
      ...data,
      id: db.products[index].id,
      created_at: db.products[index].created_at
    };
    
    return db.products[index];
  },
  
  delete: async (id) => {
    const index = db.products.findIndex(p => p.id === id);
    if (index === -1) return null;
    
    const deleted = db.products.splice(index, 1)[0];
    return deleted;
  }
};

// Функции для работы с проектами расчётов
const calculationProjects = {
  create: async (userId, projectData) => {
    const project = {
      id: generateUUID(),
      user_id: userId,
      name: projectData.name,
      evaporator_type: projectData.evaporatorType,
      flow_direction: projectData.flowDirection,
      number_of_effects: projectData.numberOfEffects,
      feed_flow_rate: projectData.feedFlowRate,
      initial_concentration: projectData.initialConcentration,
      final_concentration: projectData.finalConcentration,
      steam_temperature: projectData.steamTemperature,
      heat_transfer_coefficient: projectData.heatTransferCoefficient,
      vaporization_heat: projectData.vaporizationHeat,
      condensation_heat: projectData.condensationHeat,
      pressure_loss: projectData.pressureLoss || null,
      vacuum_pressure: projectData.vacuumPressure || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.calculation_projects.push(project);
    return project;
  },
  
  findById: async (id, userId = null) => {
    let project = db.calculation_projects.find(p => p.id === id);
    if (userId && project && project.user_id !== userId) {
      return null;
    }
    return project;
  },
  
  findAllByUser: async (userId) => {
    return db.calculation_projects
      .filter(p => p.user_id === userId)
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  },
  
  delete: async (id, userId) => {
    const index = db.calculation_projects.findIndex(p => p.id === id && p.user_id === userId);
    if (index === -1) return null;
    
    const deleted = db.calculation_projects.splice(index, 1)[0];
    
    // Удаляем связанные результаты
    db.calculation_results = db.calculation_results.filter(r => r.project_id !== deleted.id);
    
    return deleted;
  }
};

// Функции для работы с результатами расчётов
const calculationResults = {
  create: async (projectId, stageData) => {
    const result = {
      id: generateUUID(),
      project_id: projectId,
      stage_number: stageData.stageNumber,
      temperature: stageData.temperature,
      pressure: stageData.pressure,
      feed_flow_rate: stageData.feedFlowRate,
      evaporated_water: stageData.evaporatedWater,
      concentration_in: stageData.concentrationIn,
      concentration_out: stageData.concentrationOut,
      steam_consumption: stageData.steamConsumption,
      heat_exchange_area: stageData.heatExchangeArea,
      heat_load: stageData.heatLoad,
      created_at: new Date().toISOString()
    };
    db.calculation_results.push(result);
    return result;
  },
  
  findByProjectId: async (projectId) => {
    return db.calculation_results
      .filter(r => r.project_id === projectId)
      .sort((a, b) => a.stage_number - b.stage_number);
  },
  
  countByProjectId: async (projectId) => {
    return db.calculation_results.filter(r => r.project_id === projectId).length;
  }
};

// Функции для работы со справочными таблицами
const referenceTables = {
  create: async (userId, data) => {
    const table = {
      id: generateUUID(),
      user_id: userId,
      name: data.name,
      source_image: data.source_image || null,
      group_id: data.group_id || null,
      headers: data.headers,
      rows: data.rows,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.reference_tables.push(table);
    return table;
  },

  createBatch: async (userId, groupId, groupName, tablesData) => {
    const now = new Date().toISOString();
    const tables = tablesData.map(data => ({
      id: generateUUID(),
      user_id: userId,
      name: data.name,
      source_image: null,
      group_id: groupId,
      group_name: groupName,
      headers: data.headers,
      rows: data.rows,
      created_at: now,
      updated_at: now
    }));
    db.reference_tables.push(...tables);
    return tables;
  },

  renameGroup: async (groupId, userId, groupName) => {
    const now = new Date().toISOString();
    db.reference_tables
      .filter(t => t.group_id === groupId && t.user_id === userId)
      .forEach(t => { t.group_name = groupName; t.updated_at = now; });
    return true;
  },

  findAll: async (userId) => {
    return db.reference_tables
      .filter(t => t.user_id === userId)
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  },

  findById: async (id, userId) => {
    const t = db.reference_tables.find(t => t.id === id);
    if (!t || t.user_id !== userId) return null;
    return t;
  },

  update: async (id, userId, data) => {
    const index = db.reference_tables.findIndex(t => t.id === id && t.user_id === userId);
    if (index === -1) return null;
    db.reference_tables[index] = {
      ...db.reference_tables[index],
      ...data,
      id,
      user_id: userId,
      updated_at: new Date().toISOString()
    };
    return db.reference_tables[index];
  },

  delete: async (id, userId) => {
    const index = db.reference_tables.findIndex(t => t.id === id && t.user_id === userId);
    if (index === -1) return null;
    return db.reference_tables.splice(index, 1)[0];
  }
};

module.exports = {
  initDB,
  users,
  products,
  calculationProjects,
  calculationResults,
  referenceTables
};
