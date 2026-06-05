import { defineStore } from 'pinia';
import { db } from '@/utils/db.js';

export const useLogStore = defineStore('log', {
  state: () => ({
    logs: [],
    lastWeights: {} // 用于记忆每个动作上一次的重量
  }),
  actions: {
    async fetchLogs(limit = 20, offset = 0) {
      try {
        const res = await db.select(`
          SELECT * FROM workout_logs 
          ORDER BY date DESC, id DESC 
          LIMIT ? OFFSET ?`, 
          [limit, offset]
        );
        const mappedRes = res.map(log => ({
          ...log,
          category: log.category === '腹部' ? '核心' : log.category
        }));
        if (offset === 0) {
          this.logs = mappedRes;
        } else {
          this.logs = [...this.logs, ...mappedRes];
        }
      } catch (e) {
        console.error('Fetch logs failed', e);
      }
    },
    async saveWorkout(date, actions) {
      const groupId = Date.now().toString();
      try {
        for (const action of actions) {
          await db.execute(
            'INSERT INTO workout_logs (date, action_id, action_name, category, sets, reps, weight, note, group_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [date, action.id || 0, action.name, action.category, action.sets || 0, action.reps || 0, action.weight || 0, action.note || '', groupId]
          );
        }
        await this.fetchLogs();
      } catch (e) {
        console.error('Save workout failed', e);
        throw e;
      }
    },
    async fetchLastWeight(actionId) {
      try {
        const res = await db.select(
          'SELECT weight FROM workout_logs WHERE action_id = ? ORDER BY date DESC, id DESC LIMIT 1',
          [actionId]
        );
        if (res && res.length > 0) {
          return res[0].weight;
        }
        return 0;
      } catch (e) {
        console.error('Fetch last weight failed', e);
        return 0;
      }
    }
  }
});
