import { defineStore } from 'pinia';
import { db } from '@/utils/db.js';

export const useExerciseStore = defineStore('exercise', {
  state: () => ({
    actions: []
  }),
  actions: {
    async fetchActions() {
      try {
        const res = await db.select('SELECT * FROM exercise_actions');
        this.actions = res.map(action => ({
          ...action,
          category: action.category === '腹部' ? '核心' : action.category,
          equipment_type: action.equipment_type || 'other',
          dumbbell_count: action.dumbbell_count || 1
        }));
      } catch (e) {
        console.error('Fetch actions failed', e);
      }
    },
    async addAction(name, category, equipment_type = 'other', dumbbell_count = 1) {
      try {
        await db.execute('INSERT INTO exercise_actions (name, category, equipment_type, dumbbell_count) VALUES (?, ?, ?, ?)', 
          [name, category, equipment_type, dumbbell_count]);
        await this.fetchActions();
      } catch (e) {
        console.error('Add action failed', e);
      }
    },
    async updateAction(id, updates) {
      try {
        const { name, category, equipment_type, dumbbell_count } = updates;
        await db.execute('UPDATE exercise_actions SET name = ?, category = ?, equipment_type = ?, dumbbell_count = ? WHERE id = ?', 
          [name, category, equipment_type, dumbbell_count, id]);
        await this.fetchActions();
      } catch (e) {
        console.error('Update action failed', e);
      }
    },
    async deleteAction(id) {
      try {
        await db.execute('DELETE FROM exercise_actions WHERE id = ?', [id]);
        await this.fetchActions();
      } catch (e) {
        console.error('Delete action failed', e);
      }
    }
  }
});
