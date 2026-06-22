import { defineStore } from 'pinia';
import { db } from '@/utils/db.js';

export const useEquipmentStore = defineStore('equipment', {
  state: () => ({
    inventory: []
  }),
  actions: {
    async fetchInventory() {
      try {
        const res = await db.select('SELECT * FROM equipment_inventory');
        this.inventory = res;
      } catch (e) {
        console.error('Fetch inventory failed', e);
      }
    },
    async addEquipment(item) {
      try {
        const { type, weight, count, name } = item;
        await db.execute('INSERT INTO equipment_inventory (type, weight, count, name) VALUES (?, ?, ?, ?)', 
          [type, weight, count, name]);
        await this.fetchInventory();
      } catch (e) {
        console.error('Add equipment failed', e);
      }
    },
    async updateEquipment(id, updates) {
      try {
        const { type, weight, count, name } = updates;
        await db.execute('UPDATE equipment_inventory SET type = ?, weight = ?, count = ?, name = ? WHERE id = ?', 
          [type, weight, count, name, id]);
        await this.fetchInventory();
      } catch (e) {
        console.error('Update equipment failed', e);
      }
    },
    async deleteEquipment(id) {
      try {
        await db.execute('DELETE FROM equipment_inventory WHERE id = ?', [id]);
        await this.fetchInventory();
      } catch (e) {
        console.error('Delete equipment failed', e);
      }
    }
  }
});
