import { defineStore } from 'pinia';
import { db } from '@/utils/db.js';

export const usePlanStore = defineStore('plan', {
  state: () => ({
    activePlan: null,
    planDetails: [],
    adjustments: []
  }),
  actions: {
    async fetchAdjustments() {
      try {
        const res = await db.select('SELECT * FROM schedule_adjustments');
        this.adjustments = res;
      } catch (e) {
        console.error('Fetch adjustments failed', e);
      }
    },
    async addAdjustment(date, type = 'REST') {
      try {
        await db.execute('INSERT INTO schedule_adjustments (adjust_date, type) VALUES (?, ?)', [date, type]);
        await this.fetchAdjustments();
      } catch (e) {
        console.error('Add adjustment failed', e);
      }
    },
    async fetchActivePlan() {
      try {
        const res = await db.select('SELECT * FROM plan_configs WHERE is_active = 1 LIMIT 1');
        if (res && res.length > 0) {
          this.activePlan = res[0];
          await this.fetchPlanDetails(this.activePlan.id);
          await this.fetchAdjustments();
        } else {
          this.activePlan = null;
          this.planDetails = [];
          this.adjustments = [];
        }
      } catch (e) {
        console.error('Fetch active plan failed', e);
      }
    },
    // 计算指定日期对应的训练内容
    getPlanForDate(targetDateStr) {
      if (!this.activePlan || this.planDetails.length === 0) return null;

      // 如果是自由训练模式，直接返回模板动作，不参与循环和休息计算
      if (this.activePlan.split_type === 0) {
        return {
          isRest: false,
          ...this.planDetails[0]
        };
      }

      const startDate = new Date(this.activePlan.start_date);
      const targetDate = new Date(targetDateStr);
      
      if (targetDate < startDate) return null;

      // 1. 计算总天数差
      const diffTime = targetDate - startDate;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      // 2. 统计 startDate 到 targetDate 之间的所有主动休息调整记录
      const adjustmentsBefore = this.adjustments.filter(adj => {
        const adjDate = new Date(adj.adjust_date);
        return adjDate >= startDate && adjDate < targetDate;
      }).length;

      // 检查 targetDate 本身是否是主动休息日
      const isTodayRestAdjustment = this.adjustments.some(adj => adj.adjust_date === targetDateStr);
      if (isTodayRestAdjustment) return { isRest: true, reason: '主动休息' };

      // 3. 计算逻辑偏移量 (实际训练步数)
      const logicSteps = diffDays - adjustmentsBefore;

      // 4. 计算循环周期长度 (训练天数 + 固定休息天数)
      const cycleLength = this.activePlan.split_type + this.activePlan.rest_days;
      const indexInCycle = logicSteps % cycleLength;

      // 5. 判断是否处于固定休息日
      if (indexInCycle >= this.activePlan.split_type) {
        return { isRest: true, reason: '计划内休息' };
      }

      // 6. 返回对应的训练详情
      const detail = this.planDetails[indexInCycle];
      return {
        isRest: false,
        ...detail
      };
    },
    async fetchPlanDetails(planId) {
      try {
        const res = await db.select('SELECT * FROM plan_details WHERE plan_id = ? ORDER BY day_index ASC', [planId]);
        this.planDetails = res.map(item => ({
          ...item,
          action_ids: JSON.parse(item.action_ids || '[]'),
          settings: JSON.parse(item.settings || '{}')
        }));
      } catch (e) {
        console.error('Fetch plan details failed', e);
      }
    },
    async savePlan(config, details) {
      try {
        // 1. Deactivate current active plan
        await db.execute('UPDATE plan_configs SET is_active = 0');
        
        // 2. Insert new plan config
        await db.execute(
          'INSERT INTO plan_configs (split_type, rest_days, start_date, is_active) VALUES (?, ?, ?, ?)',
          [config.split_type, config.rest_days, config.start_date, 1]
        );
        
        // 3. Get the new plan id
        const res = await db.select('SELECT last_insert_rowid() as id');
        const planId = res[0].id;
        console.log('New plan created with ID:', planId);
        
        // 4. Insert plan details
        for (const detail of details) {
          await db.execute(
            'INSERT INTO plan_details (plan_id, day_index, target_group, action_ids, settings) VALUES (?, ?, ?, ?, ?)',
            [planId, detail.day_index, detail.target_group, JSON.stringify(detail.action_ids), JSON.stringify(detail.settings)]
          );
        }
        
        // 5. Clear adjustments when resetting plan start date
        await db.execute('DELETE FROM schedule_adjustments');
        
        await this.fetchActivePlan();
      } catch (e) {
        console.error('Save plan failed', e);
        throw e;
      }
    }
  }
});
