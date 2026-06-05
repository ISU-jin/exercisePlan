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
        this.actions = res;
      } catch (e) {
        console.error('Fetch actions failed', e);
      }
    },
    async addAction(name, category) {
      try {
        await db.execute('INSERT INTO exercise_actions (name, category) VALUES (?, ?)', [name, category]);
        await this.fetchActions();
      } catch (e) {
        console.error('Add action failed', e);
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
