const DB_NAME = 'exercise_plan_db';
const DB_PATH = '_doc/exercise_plan.db';

// 判断是否是 App 环境
const isApp = typeof plus !== 'undefined' && plus.sqlite;

// H5 模拟数据库存储
const h5Storage = {
  getData() {
    return JSON.parse(localStorage.getItem(DB_NAME) || '{}');
  },
  setData(data) {
    localStorage.setItem(DB_NAME, JSON.stringify(data));
  },
  lastId: 0
};

export const db = {
  // 打开数据库
  open() {
    if (!isApp) return Promise.resolve();
    return new Promise((resolve, reject) => {
      plus.sqlite.openDatabase({
        name: DB_NAME,
        path: DB_PATH,
        success: () => resolve(),
        fail: (e) => reject(e)
      });
    });
  },

  // 执行 SQL
  execute(sql, values = []) {
    if (!isApp) {
      // H5 环境下的模拟执行逻辑
      const data = h5Storage.getData();
      const lowerSql = sql.toLowerCase();
      
      if (lowerSql.includes('create table')) {
        const tableNameMatch = sql.match(/table if not exists (\w+)/i);
        if (tableNameMatch) {
          const tableName = tableNameMatch[1];
          if (!data[tableName]) data[tableName] = [];
        }
      } else if (lowerSql.includes('insert into')) {
        const tableNameMatch = sql.match(/insert into (\w+)/i);
        if (tableNameMatch) {
          const tableName = tableNameMatch[1];
          const newItem = { id: Date.now() };
          h5Storage.lastId = newItem.id;
          
          // 改进的插入逻辑：解析列名和值
          const colMatch = sql.match(/\((.*?)\)/);
          const valMatch = sql.match(/values\s*\((.*)\)/i);
          
          if (colMatch && valMatch) {
            const cols = colMatch[1].split(',').map(c => c.trim());
            const rawVals = valMatch[1].split(',').map(v => v.trim());
            
            let paramIndex = 0;
            cols.forEach((col, i) => {
              const rawVal = rawVals[i];
              if (rawVal === '?') {
                const val = values[paramIndex++];
                newItem[col] = val;
                if (col === 'id') h5Storage.lastId = val;
              } else {
                // 处理硬编码在 SQL 中的数字或字符串
                const cleanVal = rawVal.replace(/'/g, '');
                const val = isNaN(cleanVal) ? cleanVal : Number(cleanVal);
                newItem[col] = val;
                if (col === 'id') h5Storage.lastId = val;
              }
            });
          }
          
          if (!data[tableName]) data[tableName] = [];
          data[tableName].push(newItem);
          console.log(`[H5 DB] Inserted into ${tableName}:`, newItem);
        }
      } else if (lowerSql.includes('delete from')) {
        const tableNameMatch = sql.match(/delete from (\w+)/i);
        if (tableNameMatch) {
          const tableName = tableNameMatch[1];
          if (lowerSql.includes('where id = ?')) {
            data[tableName] = (data[tableName] || []).filter(item => item.id !== values[0]);
          } else {
            data[tableName] = [];
          }
        }
      } else if (lowerSql.includes('update')) {
        const tableNameMatch = sql.match(/update (\w+)/i);
        if (tableNameMatch) {
          const tableName = tableNameMatch[1];
          const setMatch = sql.match(/set\s+(.*?)(?:\s+where|$)/i);
          if (setMatch) {
            const setClauses = setMatch[1].split(',').map(s => s.trim());
            const whereMatch = sql.match(/where\s+(.*)/i);
            
            let filteredItems = data[tableName] || [];
            let paramIndex = 0;

            if (whereMatch) {
              const whereClause = whereMatch[1].toLowerCase();
              if (whereClause.includes('id = ?')) {
                // 如果 WHERE 中有 id=?，它通常是最后一个参数
                // 我们需要先计算 SET 中的参数个数
                const setParamCount = (setMatch[1].match(/\?/g) || []).length;
                const idValue = values[setParamCount]; // 获取对应位置的 ID
                filteredItems = filteredItems.filter(item => item.id === idValue);
              } else if (whereClause.includes('is_active = 1')) {
                filteredItems = filteredItems.filter(item => item.is_active === 1);
              }
            }

            setClauses.forEach(clause => {
              const [col, val] = clause.split('=').map(s => s.trim());
              filteredItems.forEach(item => {
                if (val === '?') {
                  item[col] = values[paramIndex];
                } else {
                  const cleanVal = val.replace(/'/g, '');
                  item[col] = isNaN(cleanVal) ? cleanVal : Number(cleanVal);
                }
              });
              if (val === '?') paramIndex++;
            });
            console.log(`[H5 DB] Updated ${tableName}:`, filteredItems);
          }
        }
      }
      
      h5Storage.setData(data);
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      plus.sqlite.executeSql({
        name: DB_NAME,
        sql: this.replacePlaceholders(sql, values),
        success: (res) => resolve(res),
        fail: (e) => reject(e)
      });
    });
  },

  // 查询 SQL
  select(sql, values = []) {
    if (!isApp) {
      const lowerSql = sql.toLowerCase();
      
      // 特殊处理 last_insert_rowid
      if (lowerSql.includes('last_insert_rowid')) {
        return Promise.resolve([{ id: h5Storage.lastId }]);
      }

      const data = h5Storage.getData();
      const tableNameMatch = sql.match(/from (\w+)/i);
      if (!tableNameMatch) return Promise.resolve([]);
      
      const tableName = tableNameMatch[1];
      let res = data[tableName] || [];
      
      // 处理简单的 WHERE 过滤
      if (lowerSql.includes('is_active = 1')) {
        res = res.filter(item => item.is_active === 1);
      } else if (lowerSql.includes('plan_id = ?')) {
        res = res.filter(item => item.plan_id === values[0]);
      } else if (lowerSql.includes('action_id = ?')) {
        res = res.filter(item => item.action_id === values[0]);
      }
      
      // 处理排序
      if (lowerSql.includes('order by date desc')) {
        res = [...res].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      } else if (lowerSql.includes('order by record_date desc')) {
        res = [...res].sort((a, b) => (b.record_date || '').localeCompare(a.record_date || ''));
      } else if (lowerSql.includes('order by day_index asc')) {
        res = [...res].sort((a, b) => (a.day_index || 0) - (b.day_index || 0));
      }

      // 处理 LIMIT
      if (lowerSql.includes('limit 1')) {
        res = res.slice(0, 1);
      }
      
      return Promise.resolve(res);
    }

    return new Promise((resolve, reject) => {
      plus.sqlite.selectSql({
        name: DB_NAME,
        sql: this.replacePlaceholders(sql, values),
        success: (res) => resolve(res),
        fail: (e) => reject(e)
      });
    });
  },

  // 辅助函数：将 ? 占位符替换为实际值（SQLite 接口需要完整 SQL）
  replacePlaceholders(sql, values) {
    if (!values || values.length === 0) return sql;
    let index = 0;
    return sql.replace(/\?/g, () => {
      const val = values[index++];
      return typeof val === 'string' ? `'${val}'` : val;
    });
  },

  // 初始化数据库表
  async init() {
    try {
      if (isApp) {
        if (!plus.sqlite.isOpenDatabase({ name: DB_NAME, path: DB_PATH })) {
          await this.open();
        }
      }

      await this.execute(`CREATE TABLE IF NOT EXISTS exercise_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        name TEXT, 
        category TEXT, 
        custom INTEGER DEFAULT 1,
        equipment_type TEXT,
        dumbbell_count INTEGER
      )`);
      try {
        await this.execute(`ALTER TABLE exercise_actions ADD COLUMN equipment_type TEXT`);
      } catch (e) {}
      try {
        await this.execute(`ALTER TABLE exercise_actions ADD COLUMN dumbbell_count INTEGER`);
      } catch (e) {}

      await this.execute(`CREATE TABLE IF NOT EXISTS equipment_inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT, -- 'weight_plate', 'fixed_dumbbell', 'dumbbell_handle', 'barbell', 'pulley_base'
        weight REAL,
        count INTEGER,
        name TEXT
      )`);
      await this.execute(`CREATE TABLE IF NOT EXISTS plan_configs (id INTEGER PRIMARY KEY AUTOINCREMENT, split_type INTEGER, rest_days INTEGER, start_date TEXT, is_active INTEGER DEFAULT 1)`);
      await this.execute(`CREATE TABLE IF NOT EXISTS plan_details (id INTEGER PRIMARY KEY AUTOINCREMENT, plan_id INTEGER, day_index INTEGER, target_group TEXT, action_ids TEXT, settings TEXT)`);
      await this.execute(`CREATE TABLE IF NOT EXISTS workout_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        date TEXT, 
        action_id INTEGER, 
        action_name TEXT, 
        category TEXT,
        sets INTEGER, 
        reps INTEGER, 
        weight REAL, 
        note TEXT,
        group_id TEXT,
        reps_detail TEXT,
        weight_detail TEXT
      )`);
      try {
        await this.execute(`ALTER TABLE workout_logs ADD COLUMN reps_detail TEXT`);
      } catch (e) {
        // 已经存在则忽略
      }
      try {
        await this.execute(`ALTER TABLE workout_logs ADD COLUMN weight_detail TEXT`);
      } catch (e) {
        // 已经存在则忽略
      }
      await this.execute(`CREATE TABLE IF NOT EXISTS schedule_adjustments (id INTEGER PRIMARY KEY AUTOINCREMENT, adjust_date TEXT, type TEXT)`);
      
      // 添加索引以优化查询
      await this.execute(`CREATE INDEX IF NOT EXISTS idx_workout_logs_date ON workout_logs (date)`);
      
      // 用户数据表
      await this.execute(`CREATE TABLE IF NOT EXISTS user_intake (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tdee REAL,
        goal TEXT,
        muscle_calories REAL,
        muscle_carb REAL,
        muscle_protein REAL,
        muscle_fat REAL,
        fat_calories REAL,
        fat_carb REAL,
        fat_protein REAL,
        fat_fat REAL
      )`);
      
      await this.execute(`CREATE TABLE IF NOT EXISTS body_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        weight REAL,
        chest REAL,
        waist REAL,
        thigh REAL,
        arm REAL,
        record_date TEXT
      )`);

      console.log('Database initialized successfully (isApp: ' + isApp + ')');
    } catch (e) {
      console.error('Database initialization failed:', e);
    }
  },

  async exportData() {
    const tables = ['exercise_actions', 'plan_configs', 'plan_details', 'workout_logs', 'schedule_adjustments', 'user_intake', 'body_records', 'equipment_inventory'];
    const data = {};
    for (const table of tables) {
      data[table] = await this.select(`SELECT * FROM ${table}`);
    }
    return JSON.stringify(data);
  },

  async importData(jsonStr) {
    const data = JSON.parse(jsonStr);
    const tables = ['exercise_actions', 'plan_configs', 'plan_details', 'workout_logs', 'schedule_adjustments', 'user_intake', 'body_records', 'equipment_inventory'];
    for (const table of tables) {
      await this.execute(`DELETE FROM ${table}`);
      const rows = data[table] || [];
      for (const row of rows) {
        const keys = Object.keys(row);
        const values = keys.map(k => row[k]);
        const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
        await this.execute(sql, values);
      }
    }
    return true;
  }
};
