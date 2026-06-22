/**
 * 健身器械快捷备位算法
 */

export class EquipmentCalculator {
  constructor(inventory) {
    // 初始化可用库存 (深度克隆)
    this.availableInventory = JSON.parse(JSON.stringify(inventory));
    this.preparedPool = []; // 已组装好的器械
    this.unmetList = [];    // 无法满足的需求
    this.newActions = [];   // 无历史记录的动作
  }

  /**
   * 计算备械方案
   * @param {Array} actions 今日动作列表 (包含 action_id, name, equipment_type, dumbbell_count, last_weight)
   */
  calculate(actions) {
    for (const action of actions) {
      // 1. 过滤无需备械的动作
      if (!action.equipment_type || ['bodyweight', 'other'].includes(action.equipment_type)) {
        continue;
      }

      // 2. 检查是否有历史重量
      const targetWeight = action.last_weight;
      if (!targetWeight || targetWeight <= 0) {
        this.newActions.push(action);
        continue;
      }

      // 3. 核心计算逻辑
      this._processAction(action, targetWeight);
    }

    return {
      preparedPool: this.preparedPool,
      unmetList: this.unmetList,
      newActions: this.newActions
    };
  }

  _processAction(action, weight) {
    const type = action.equipment_type;
    const count = action.dumbbell_count || 1;

    // A. 检查复用 (Reusability Check)
    const existingCount = this._countMatchingInPool(type, weight);
    const neededCount = type === 'dumbbell' ? count : 1;
    const remainingToPrepare = neededCount - existingCount;

    if (remainingToPrepare <= 0) {
      // 完全可以复用
      return;
    }

    // B. 库存分配 (Inventory Allocation)
    if (type === 'dumbbell') {
      this._prepareDumbbell(action, weight, remainingToPrepare);
    } else if (type === 'barbell') {
      this._prepareBarbell(action, weight);
    } else if (type === 'cable') {
      this._prepareCable(action, weight);
    }
  }

  _countMatchingInPool(type, weight) {
    let count = 0;
    for (const item of this.preparedPool) {
      if (item.type === type && item.weight === weight) {
        count += (item.count || 1);
      }
    }
    return count;
  }

  _prepareDumbbell(action, weight, needed) {
    let prepared = 0;

    // 1. 优先使用固定哑铃
    const fixed = this.availableInventory.find(i => i.type === 'fixed_dumbbell' && i.weight === weight);
    if (fixed && fixed.count > 0) {
      const take = Math.min(fixed.count, needed);
      this.preparedPool.push({
        type: 'dumbbell',
        weight: weight,
        count: take,
        isFixed: true,
        name: `${weight}kg 固定哑铃`
      });
      fixed.count -= take;
      prepared += take;
    }

    if (prepared >= needed) return;

    // 2. 尝试使用可调节哑铃
    const stillNeeded = needed - prepared;
    const handles = this.availableInventory.find(i => i.type === 'dumbbell_handle');
    
    if (!handles || handles.count < stillNeeded) {
      this.unmetList.push({
        actionName: action.name,
        reason: handles ? '哑铃连接杆不足' : '未配置哑铃连接杆',
        neededWeight: weight,
        neededCount: needed
      });
      return;
    }

    // 尝试为每一把手配重
    const platesNeededPerHandle = this._calculatePlates(weight, true); // 哑铃需对称
    if (!platesNeededPerHandle) {
      this.unmetList.push({
        actionName: action.name,
        reason: '现有配重片无法精确凑出该重量(需对称)',
        neededWeight: weight,
        neededCount: needed
      });
      return;
    }

    // 检查总配重片是否足够
    const totalPlatesNeeded = {};
    Object.keys(platesNeededPerHandle).forEach(w => {
      totalPlatesNeeded[w] = platesNeededPerHandle[w] * stillNeeded;
    });

    if (this._checkPlatesAvailability(totalPlatesNeeded)) {
      // 扣减库存
      this._consumePlates(totalPlatesNeeded);
      handles.count -= stillNeeded;
      
      const plateDesc = Object.entries(platesNeededPerHandle)
        .map(([w, c]) => `${w}kg x ${c}`)
        .join(', ');

      this.preparedPool.push({
        type: 'dumbbell',
        weight: weight,
        count: stillNeeded,
        isFixed: false,
        name: `${weight}kg 可调节哑铃`,
        details: `使用 ${plateDesc}`
      });
    } else {
      this.unmetList.push({
        actionName: action.name,
        reason: '配重片库存不足',
        neededWeight: weight,
        neededCount: needed
      });
    }
  }

  _prepareBarbell(action, weight) {
    // 1. 寻找合适的杠铃杆
    const barbells = this.availableInventory
      .filter(i => i.type === 'barbell' && i.weight <= weight && i.count > 0)
      .sort((a, b) => b.weight - a.weight); // 优先使用重杆，节省片子

    let success = false;
    for (const bar of barbells) {
      const plateWeightNeeded = weight - bar.weight;
      if (plateWeightNeeded === 0) {
        this.preparedPool.push({
          type: 'barbell',
          weight: weight,
          count: 1,
          name: `${weight}kg 杠铃 (${bar.name})`
        });
        bar.count--;
        success = true;
        break;
      }

      const platesNeeded = this._calculatePlates(plateWeightNeeded, true); // 杠铃需对称
      if (platesNeeded && this._checkPlatesAvailability(platesNeeded)) {
        this._consumePlates(platesNeeded);
        bar.count--;
        
        const plateDesc = Object.entries(platesNeeded)
          .map(([w, c]) => `${w}kg x ${c}`)
          .join(', ');

        this.preparedPool.push({
          type: 'barbell',
          weight: weight,
          count: 1,
          name: `${weight}kg 杠铃 (${bar.name})`,
          details: `使用 ${plateDesc}`
        });
        success = true;
        break;
      }
    }

    if (!success) {
      this.unmetList.push({
        actionName: action.name,
        reason: barbells.length === 0 ? '无可用杠铃杆' : '配重片不足或无法精确凑重(需对称)',
        neededWeight: weight,
        neededCount: 1
      });
    }
  }

  _prepareCable(action, weight) {
    const base = this.availableInventory.find(i => i.type === 'pulley_base');
    if (!base || base.count <= 0) {
      this.unmetList.push({
        actionName: action.name,
        reason: '无可用滑轮/绳索底座',
        neededWeight: weight,
        neededCount: 1
      });
      return;
    }

    const platesNeeded = this._calculatePlates(weight, false); // 滑轮无需对称
    if (platesNeeded && this._checkPlatesAvailability(platesNeeded)) {
      this._consumePlates(platesNeeded);
      base.count--;

      const plateDesc = Object.entries(platesNeeded)
        .map(([w, c]) => `${w}kg x ${c}`)
        .join(', ');

      this.preparedPool.push({
        type: 'cable',
        weight: weight,
        count: 1,
        name: `${weight}kg 滑轮/绳索`,
        details: `使用 ${plateDesc}`
      });
    } else {
      this.unmetList.push({
        actionName: action.name,
        reason: '配重片库存不足或无法精确凑重',
        neededWeight: weight,
        neededCount: 1
      });
    }
  }

  /**
   * 计算所需配重片 (使用回溯算法寻找可行方案)
   * @param {number} targetWeight 目标总重量
   * @param {boolean} symmetric 是否需要对称
   */
  _calculatePlates(targetWeight, symmetric) {
    if (targetWeight < 0) return null;
    if (Math.abs(targetWeight) < 0.01) return {};

    const availablePlates = this.availableInventory
      .filter(i => i.type === 'weight_plate' && i.count > 0)
      .sort((a, b) => b.weight - a.weight);

    const result = {};
    const memo = new Map();

    const solve = (remaining, index) => {
      if (Math.abs(remaining) < 0.01) return {};
      if (index >= availablePlates.length) return null;

      const memoKey = `${remaining.toFixed(2)}-${index}`;
      if (memo.has(memoKey)) return memo.get(memoKey);

      const plate = availablePlates[index];
      const unit = symmetric ? plate.weight * 2 : plate.weight;
      
      // 尝试使用当前规格的片子，从多到少尝试
      let maxCount = Math.floor((remaining + 0.001) / unit);
      const availableUnits = symmetric ? Math.floor(plate.count / 2) : plate.count;
      maxCount = Math.min(maxCount, availableUnits);

      for (let c = maxCount; c >= 0; c--) {
        const subResult = solve(remaining - c * unit, index + 1);
        if (subResult !== null) {
          const res = { ...subResult };
          if (c > 0) {
            res[plate.weight] = (res[plate.weight] || 0) + (symmetric ? c * 2 : c);
          }
          memo.set(memoKey, res);
          return res;
        }
      }

      memo.set(memoKey, null);
      return null;
    };

    return solve(targetWeight, 0);
  }

  _checkPlatesAvailability(neededPlates) {
    for (const [weight, count] of Object.entries(neededPlates)) {
      const plate = this.availableInventory.find(i => i.type === 'weight_plate' && i.weight === Number(weight));
      if (!plate || plate.count < count) return false;
    }
    return true;
  }

  _consumePlates(neededPlates) {
    for (const [weight, count] of Object.entries(neededPlates)) {
      const plate = this.availableInventory.find(i => i.type === 'weight_plate' && i.weight === Number(weight));
      plate.count -= count;
    }
  }
}
