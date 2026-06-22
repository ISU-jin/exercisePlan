<template>
  <view class="container">
    <view class="status-bar"></view>
    <view class="header-section">
      <view class="header-content">
        <view class="header-left" @click="goBack">
          <uni-icons type="back" size="24" color="#333"></uni-icons>
          <text class="page-title">个人器械库</text>
        </view>
        <view class="header-right">
          <button class="add-btn" @click="showAddPopup">
            <uni-icons type="plus" size="16" color="#fff"></uni-icons>
            <text>添加器械</text>
          </button>
        </view>
      </view>
    </view>

    <view class="main-content">
      <view v-if="equipmentStore.inventory.length === 0" class="empty-state">
        <image src="/static/dumbbell.png" mode="aspectFit" class="empty-img"></image>
        <text class="empty-text">您还没有配置任何器械</text>
        <text class="empty-sub">录入器械以启用智能备械功能</text>
      </view>

      <view v-else class="inventory-list">
        <!-- 配重片 -->
        <view v-if="getInventoryByType('weight_plate').length > 0" class="section-card">
          <view class="section-header">
            <text class="section-title">配重片</text>
          </view>
          <view class="item-grid plate-grid">
            <view v-for="item in getInventoryByType('weight_plate')" :key="item.id" class="plate-item" @click="editItem(item)">
              <view class="plate-weight">
                <text class="value">{{ item.weight }}</text>
                <text class="unit">kg</text>
              </view>
              <view class="plate-count">
                <text>x{{ item.count }}</text>
              </view>
            </view>
          </view>
        </view>

        <!-- 固定哑铃 -->
        <view v-if="getInventoryByType('fixed_dumbbell').length > 0" class="section-card">
          <view class="section-header">
            <text class="section-title">固定重量哑铃</text>
          </view>
          <view class="item-grid">
            <view v-for="item in getInventoryByType('fixed_dumbbell')" :key="item.id" class="inventory-item" @click="editItem(item)">
              <view class="item-main">
                <text class="item-value">{{ item.weight }}</text>
                <text class="item-unit">kg</text>
              </view>
              <view class="item-badge">
                <text>x{{ item.count }}</text>
              </view>
            </view>
          </view>
        </view>

        <!-- 哑铃连接杆 -->
        <view v-if="getInventoryByType('dumbbell_handle').length > 0" class="section-card">
          <view class="section-header">
            <text class="section-title">可调节哑铃杆</text>
          </view>
          <view class="item-list">
            <view v-for="item in getInventoryByType('dumbbell_handle')" :key="item.id" class="list-item" @click="editItem(item)">
              <text class="list-label">可用数量</text>
              <text class="list-value">{{ item.count }} 根</text>
            </view>
          </view>
        </view>

        <!-- 杠铃杆 -->
        <view v-if="getInventoryByType('barbell').length > 0" class="section-card">
          <view class="section-header">
            <text class="section-title">杠铃杆</text>
          </view>
          <view class="item-list">
            <view v-for="item in getInventoryByType('barbell')" :key="item.id" class="list-item" @click="editItem(item)">
              <view class="list-info">
                <text class="list-name">{{ item.name }}</text>
                <text class="list-sub">{{ item.weight }}kg</text>
              </view>
              <text class="list-value">x{{ item.count }}</text>
            </view>
          </view>
        </view>

        <!-- 滑轮/绳索底座 -->
        <view v-if="getInventoryByType('pulley_base').length > 0" class="section-card">
          <view class="section-header">
            <text class="section-title">滑轮/绳索底座</text>
          </view>
          <view class="item-list">
            <view v-for="item in getInventoryByType('pulley_base')" :key="item.id" class="list-item" @click="editItem(item)">
              <text class="list-label">可用数量</text>
              <text class="list-value">{{ item.count }} 个</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 添加/编辑弹窗 -->
    <uni-popup ref="editPopup" type="bottom">
      <view class="popup-content">
        <view class="popup-header">
          <text class="title">{{ isEdit ? '编辑器械' : '添加器械' }}</text>
          <uni-icons type="closeempty" size="20" color="#999" @click="editPopup.close()"></uni-icons>
        </view>
        
        <view class="form-body">
          <uni-forms :modelValue="form" label-position="top">
            <uni-forms-item label="器械类型" class="form-item">
              <uni-data-select v-model="form.type" :localdata="typeOptions" :disabled="isEdit" :clear="false"></uni-data-select>
            </uni-forms-item>

            <block v-if="form.type === 'barbell'">
              <uni-forms-item label="杠铃类型" class="form-item">
                <uni-easyinput v-model="form.name" placeholder="奥杆/直杆/曲杆..."></uni-easyinput>
              </uni-forms-item>
            </block>

            <block v-if="['weight_plate', 'fixed_dumbbell', 'barbell'].includes(form.type)">
              <uni-forms-item label="重量 (kg)" class="form-item">
                <uni-easyinput type="digit" v-model="form.weight" placeholder="请输入重量"></uni-easyinput>
              </uni-forms-item>
            </block>

            <uni-forms-item label="可用数量" class="form-item">
              <view class="number-box-wrap">
                <uni-number-box v-model="form.count" :min="1" :max="99"></uni-number-box>
              </view>
            </uni-forms-item>
          </uni-forms>
        </view>
        
        <view class="popup-footer">
          <button v-if="isEdit" class="delete-btn" @click="deleteItem">删除</button>
          <button class="save-btn" @click="saveItem">确定</button>
        </view>
      </view>
    </uni-popup>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useEquipmentStore } from '@/stores/equipment.js';

const equipmentStore = useEquipmentStore();
const editPopup = ref(null);
const isEdit = ref(false);
const form = ref({
  id: null,
  type: 'weight_plate',
  weight: '',
  count: 1,
  name: ''
});

const typeOptions = [
  { text: '配重片', value: 'weight_plate' },
  { text: '固定哑铃', value: 'fixed_dumbbell' },
  { text: '可调节哑铃杆', value: 'dumbbell_handle' },
  { text: '杠铃杆', value: 'barbell' },
  { text: '滑轮底座', value: 'pulley_base' }
];

onMounted(() => {
  equipmentStore.fetchInventory();
});

const getInventoryByType = (type) => {
  return equipmentStore.inventory.filter(item => item.type === type);
};

const goBack = () => {
  uni.navigateBack();
};

const showAddPopup = () => {
  isEdit.value = false;
  form.value = {
    id: null,
    type: 'weight_plate',
    weight: '',
    count: 1,
    name: ''
  };
  editPopup.value.open();
};

const editItem = (item) => {
  isEdit.value = true;
  form.value = { ...item };
  editPopup.value.open();
};

const saveItem = async () => {
  if (['weight_plate', 'fixed_dumbbell', 'barbell'].includes(form.value.type) && !form.value.weight) {
    uni.showToast({ title: '请输入重量', icon: 'none' });
    return;
  }
  
  if (isEdit.value) {
    await equipmentStore.updateEquipment(form.value.id, {
      ...form.value,
      weight: form.value.weight ? Number(form.value.weight) : 0,
      count: Number(form.value.count)
    });
  } else {
    await equipmentStore.addEquipment({
      ...form.value,
      weight: form.value.weight ? Number(form.value.weight) : 0,
      count: Number(form.value.count)
    });
  }
  editPopup.value.close();
};

const deleteItem = async () => {
  uni.showModal({
    title: '确认删除',
    content: '确定要删除该器械吗？',
    success: async (res) => {
      if (res.confirm) {
        await equipmentStore.deleteEquipment(form.value.id);
        editPopup.value.close();
      }
    }
  });
};
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background-color: #f5f5f5;
  display: flex;
  flex-direction: column;
}

.status-bar {
  height: var(--status-bar-height);
  background-color: #fff;
}

.header-section {
  background-color: #fff;
  padding: 20rpx 30rpx;
  position: sticky;
  top: 0;
  z-index: 10;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.page-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
}

.add-btn {
  display: flex;
  align-items: center;
  gap: 8rpx;
  background: #007aff;
  color: #fff;
  font-size: 24rpx;
  padding: 10rpx 24rpx;
  border-radius: 30rpx;
  line-height: 1.5;
  border: none;
}

.main-content {
  flex: 1;
  padding: 30rpx;
  padding-bottom: calc(30rpx + env(safe-area-inset-bottom));
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 200rpx;
}

.empty-img {
  width: 200rpx;
  height: 200rpx;
  margin-bottom: 30rpx;
  opacity: 0.5;
}

.empty-text {
  font-size: 32rpx;
  color: #333;
  margin-bottom: 10rpx;
}

.empty-sub {
  font-size: 24rpx;
  color: #999;
}

.section-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 32rpx;
  margin-bottom: 32rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.03);
}

.section-header {
  margin-bottom: 24rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #999;
}

.plate-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20rpx;
}

.plate-item {
  background: #f8f9fa;
  border-radius: 16rpx;
  padding: 24rpx 10rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: all 0.2s;
  &:active {
    transform: scale(0.95);
    background: #f0f1f2;
  }
}

.plate-weight {
  display: flex;
  align-items: baseline;
  margin-bottom: 8rpx;
  .value {
    font-size: 32rpx;
    font-weight: bold;
    color: #333;
  }
  .unit {
    font-size: 20rpx;
    color: #999;
    margin-left: 4rpx;
  }
}

.plate-count {
  font-size: 22rpx;
  color: #666;
  background: #fff;
  padding: 2rpx 12rpx;
  border-radius: 20rpx;
  border: 1rpx solid #eee;
}

.item-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20rpx;
}

.inventory-item {
  background: #f8f9fa;
  border-radius: 16rpx;
  padding: 24rpx 10rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.item-main {
  display: flex;
  align-items: baseline;
}

.item-value {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.item-unit {
  font-size: 20rpx;
  color: #999;
  margin-left: 4rpx;
}

.item-badge {
  font-size: 22rpx;
  color: #666;
  margin-top: 10rpx;
  background: #fff;
  padding: 2rpx 12rpx;
  border-radius: 20rpx;
  border: 1rpx solid #eee;
}

.item-list {
  display: flex;
  flex-direction: column;
}

.list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
  &:first-child {
    padding-top: 0;
  }
}

.list-label {
  font-size: 28rpx;
  color: #333;
}

.list-value {
  font-size: 30rpx;
  font-weight: bold;
  color: #007aff;
}

.list-info {
  display: flex;
  flex-direction: column;
}

.list-name {
  font-size: 28rpx;
  color: #333;
  font-weight: 600;
}

.list-sub {
  font-size: 22rpx;
  color: #999;
  margin-top: 4rpx;
}

.popup-content {
  background-color: #fff;
  border-radius: 40rpx 40rpx 0 0;
  padding: 40rpx;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 48rpx;
  .title {
    font-size: 36rpx;
    font-weight: bold;
    color: #333;
  }
}

.form-body {
  margin-bottom: 48rpx;
}

.form-item {
  margin-bottom: 32rpx;
  :deep(.uni-forms-item__label) {
    font-size: 26rpx;
    font-weight: 600;
    color: #666;
    margin-bottom: 16rpx;
  }
}

.number-box-wrap {
  display: flex;
  justify-content: flex-start;
}

.popup-footer {
  display: flex;
  gap: 24rpx;
  padding-bottom: env(safe-area-inset-bottom);
}

.save-btn {
  flex: 1;
  background: linear-gradient(135deg, #007aff, #005bb7);
  color: #fff;
  border-radius: 44rpx;
  font-size: 32rpx;
  font-weight: 600;
  height: 88rpx;
  line-height: 88rpx;
  border: none;
  &::after { border: none; }
}

.delete-btn {
  width: 200rpx;
  background: #fff;
  color: #ff4d4f;
  border: 2rpx solid #ff4d4f;
  border-radius: 44rpx;
  font-size: 32rpx;
  height: 88rpx;
  line-height: 88rpx;
}
</style>
