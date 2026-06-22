<template>
  <view class="container">
    <view class="status-bar"></view>
    
    <view class="header-section">
      <view class="title-wrapper">
        <text class="main-title">动作库</text>
        <text class="sub-title">管理您的训练动作</text>
      </view>
      <button class="add-fab" @click="showAddDialog">
        <uni-icons type="plus" size="24" color="#fff"></uni-icons>
      </button>
    </view>

    <!-- 搜索栏 -->
    <view class="search-section">
      <uni-search-bar 
        v-model="searchKeyword" 
        placeholder="搜索动作名称" 
        @confirm="onSearch" 
        @cancel="onSearchCancel"
        @clear="onSearchClear"
        radius="10"
        bgColor="#fff"
      ></uni-search-bar>
    </view>

    <!-- 分类滑动选择器 -->
    <scroll-view class="category-scroll" scroll-x="true" show-scrollbar="false">
      <view 
        class="cat-item" 
        :class="{ active: currentCat === '全部' }"
        @click="currentCat = '全部'"
      >全部</view>
      <view 
        v-for="cat in mainCategories" 
        :key="cat" 
        class="cat-item"
        :class="{ active: currentCat === cat }"
        @click="currentCat = cat"
      >{{ cat }}</view>
    </scroll-view>

    <view class="content-body">
      <view v-if="filteredActions.length === 0" class="empty-state">
        <image class="empty-img" src="/static/dumbbell.png" mode="aspectFit"></image>
        <text class="empty-text">该分类下还没有动作</text>
        <text class="empty-sub">点击右上方按钮开始添加</text>
      </view>

      <view v-else class="action-grid">
        <view v-for="action in filteredActions" :key="action.id" class="action-card" @click="showEditDialog(action)">
          <view class="card-left">
            <view class="tag-row">
              <view class="category-tag">{{ action.category }}</view>
              <view v-if="action.equipment_type && action.equipment_type !== 'other'" class="equipment-tag" :class="action.equipment_type">
                {{ getEquipmentLabel(action.equipment_type) }}
                {{ action.equipment_type === 'dumbbell' ? (action.dumbbell_count === 1 ? '(单)' : '(双)') : '' }}
              </view>
            </view>
            <text class="action-name">{{ action.name }}</text>
          </view>
          <view class="card-right">
            <view class="icon-btn delete" @click.stop="confirmDelete(action)">
              <uni-icons type="trash" size="20" color="#ff4d4f"></uni-icons>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 新增/编辑动作弹窗 -->
    <uni-popup ref="addPopup" type="center">
      <view class="modern-dialog">
        <view class="dialog-header">
          <text>{{ isEdit ? '编辑动作' : '新增动作' }}</text>
          <uni-icons type="closeempty" size="20" color="#999" @click="addPopup.close()"></uni-icons>
        </view>
        <view class="dialog-body">
          <view class="input-item">
            <text class="label">所属部位</text>
            <uni-data-select
              v-model="newCategory"
              :localdata="categoryOptions"
              placeholder="选择细分部位"
              :clear="false"
            ></uni-data-select>
          </view>
          <view class="input-item">
            <text class="label">动作名称</text>
            <uni-easyinput 
              v-model="newName" 
              placeholder="例如: 杠铃卧推" 
              :inputBorder="false"
              class="custom-input"
            ></uni-easyinput>
          </view>
          
          <view class="input-item">
            <text class="label">器械类型</text>
            <uni-data-select
              v-model="newEquipmentType"
              :localdata="equipmentOptions"
              placeholder="选择器械类型"
            ></uni-data-select>
          </view>

          <view class="input-item" v-if="newEquipmentType === 'dumbbell'">
            <text class="label">哑铃数量</text>
            <uni-data-checkbox 
              v-model="newDumbbellCount" 
              :localdata="[{text:'单手', value:1}, {text:'双手', value:2}]"
            ></uni-data-checkbox>
          </view>
        </view>
        <view class="dialog-footer">
          <button class="cancel-btn" @click="addPopup.close()">取消</button>
          <button class="confirm-btn" @click="onAddConfirm">确认保存</button>
        </view>
      </view>
    </uni-popup>
  </view>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useExerciseStore } from '@/stores/exercise.js';
import { usePlanStore } from '@/stores/plan.js';
import { db } from '@/utils/db.js';

const exerciseStore = useExerciseStore();
const planStore = usePlanStore();
const actions = computed(() => exerciseStore.actions);

const addPopup = ref(null);
const isEdit = ref(false);
const editingId = ref(null);
const newName = ref('');
const newCategory = ref('');
const newEquipmentType = ref('other');
const newDumbbellCount = ref(1);
const currentCat = ref('全部');
const searchKeyword = ref('');

const equipmentOptions = [
  { value: 'dumbbell', text: '哑铃' },
  { value: 'barbell', text: '杠铃' },
  { value: 'cable', text: '滑轮/绳索' },
  { value: 'bodyweight', text: '自重' },
  { value: 'other', text: '其他' }
];

const getEquipmentLabel = (type) => {
  const option = equipmentOptions.find(o => o.value === type);
  return option ? option.text : '其他';
};

const mainCategories = ['胸', '背', '腿', '肩', '手臂'];

const categoryOptions = [
  { value: '胸', text: '胸' },
  { value: '背', text: '背' },
  { value: '腿', text: '腿' },
  { value: '肩-前束', text: '肩 (前束)' },
  { value: '肩-中束', text: '肩 (中束)' },
  { value: '肩-后束', text: '肩 (后束)' },
  { value: '手臂-二头', text: '手臂 (二头)' },
  { value: '手臂-三头', text: '手臂 (三头)' },
  { value: '手臂-肱肌', text: '手臂 (肱肌)' }
];

const filteredActions = computed(() => {
  let list = actions.value;
  if (currentCat.value !== '全部') {
    list = list.filter(a => a.category.startsWith(currentCat.value));
  }
  if (searchKeyword.value) {
    const kw = searchKeyword.value.toLowerCase();
    list = list.filter(a => a.name.toLowerCase().includes(kw));
  }
  return list;
});

onMounted(() => {
  exerciseStore.fetchActions();
  planStore.fetchActivePlan();
});

const onSearch = (e) => {
  searchKeyword.value = e.value;
};

const onSearchCancel = () => {
  searchKeyword.value = '';
};

const onSearchClear = () => {
  searchKeyword.value = '';
};

const showAddDialog = () => {
  isEdit.value = false;
  editingId.value = null;
  newName.value = '';
  newEquipmentType.value = 'other';
  newDumbbellCount.value = 1;
  // 如果当前选了分类且不是“全部”，则默认为该分类
  if (currentCat.value !== '全部') {
    newCategory.value = currentCat.value;
  } else {
    newCategory.value = '';
  }
  addPopup.value.open();
};

const showEditDialog = (action) => {
  isEdit.value = true;
  editingId.value = action.id;
  newName.value = action.name;
  newCategory.value = action.category;
  newEquipmentType.value = action.equipment_type || 'other';
  newDumbbellCount.value = action.dumbbell_count || 1;
  addPopup.value.open();
};

const onAddConfirm = async () => {
  if (newCategory.value === '有氧') {
    newName.value = '有氧训练';
  }
  
  if (!newName.value || !newCategory.value) {
    uni.showToast({ title: '请填写完整信息', icon: 'none' });
    return;
  }

  if (isEdit.value) {
    await exerciseStore.updateAction(editingId.value, {
      name: newName.value,
      category: newCategory.value,
      equipment_type: newEquipmentType.value,
      dumbbell_count: newDumbbellCount.value
    });
  } else {
    await exerciseStore.addAction(newName.value, newCategory.value, newEquipmentType.value, newDumbbellCount.value);
  }
  
  addPopup.value.close();
  uni.showToast({ title: isEdit.value ? '修改成功' : '添加成功' });
};

const confirmDelete = (action) => {
  // 检查动作是否在当前计划中
  const isInPlan = planStore.planDetails.some(detail => detail.action_ids.includes(action.id));
  
  let content = `确定要删除“${action.name}”吗？此操作不可撤销。`;
  if (isInPlan) {
    content = `“${action.name}”正在您的训练计划中使用。删除后，计划中的该动作将显示为“未知动作”。确定要删除吗？`;
  }

  uni.showModal({
    title: '删除确认',
    content: content,
    confirmColor: '#ff4d4f',
    success: async (res) => {
      if (res.confirm) {
        await exerciseStore.deleteAction(action.id);
        uni.showToast({ title: '已删除' });
      }
    }
  });
};
</script>

<style lang="scss" scoped>
.container {
  padding: 0 20px 40px;
}

.status-bar {
  height: var(--status-bar-height);
}

.header-section {
  padding: 15px 0 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;

  .main-title {
    font-size: 28px;
    font-weight: 800;
    color: #1a1a1a;
    display: block;
  }

  .sub-title {
    font-size: 14px;
    color: #999;
    margin-top: 4px;
  }

  .add-fab {
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #007aff, #005bb7);
    border-radius: 16px;
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
    margin: 0;
    padding: 0;
    line-height: 1;
    
    &::after { border: none; }
  }
}

.search-section {
  margin-bottom: 10px;
  :deep(.uni-searchbar) {
    padding: 0;
  }
}

.category-scroll {
  white-space: nowrap;
  margin-bottom: 20px;
  .cat-item {
    display: inline-block;
    padding: 6px 16px;
    margin-right: 10px;
    background-color: #fff;
    border-radius: 20px;
    font-size: 14px;
    color: #666;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
    &.active {
      background-color: #007aff;
      color: #fff;
      font-weight: bold;
    }
  }
}

.action-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-card {
  background-color: #fff;
  border-radius: 16px;
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
  
  .card-left {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .tag-row {
    display: flex;
    gap: 12rpx;
    margin-bottom: 8rpx;
  }

  .category-tag {
    background: #e6f7ff;
    color: #1890ff;
    font-size: 20rpx;
    padding: 4rpx 12rpx;
    border-radius: 4rpx;
  }

  .equipment-tag {
    font-size: 20rpx;
    padding: 4rpx 12rpx;
    border-radius: 4rpx;
    background: #f5f5f5;
    color: #666;
    
    &.dumbbell {
      background: #f6ffed;
      color: #52c41a;
    }
    &.barbell {
      background: #fff7e6;
      color: #fa8c16;
    }
    &.cable {
      background: #f9f0ff;
      color: #722ed1;
    }
    &.bodyweight {
      background: #fff1f0;
      color: #f5222d;
    }
  }

  .action-name {
    font-size: 17px;
    font-weight: 600;
    color: #333;
  }

  .icon-btn {
    width: 40px;
    height: 40px;
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 10px;
    
    &.delete {
      background-color: #fff1f0;
    }
  }
}

.empty-state {
  padding: 60px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  
  .empty-img {
    width: 120px;
    height: 120px;
    opacity: 0.1;
  }
  
  .empty-text {
    font-size: 16px;
    font-weight: 600;
    color: #999;
    margin-top: 20px;
  }
  
  .empty-sub {
    font-size: 13px;
    color: #ccc;
    margin-top: 8px;
  }
}

.modern-dialog {
  width: 85vw;
  background-color: #fff;
  border-radius: 24px;
  padding: 24px;
  
  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 24px;
  }
  
  .input-item {
    margin-bottom: 20px;
    
    .label {
      font-size: 13px;
      font-weight: 600;
      color: #666;
      margin-bottom: 8px;
      display: block;
    }
    
    .custom-input {
      background-color: #f5f7fa;
      border-radius: 12px;
      padding: 4px 0;
    }
  }
  
  .dialog-footer {
    display: flex;
    gap: 12px;
    margin-top: 30px;
    
    button {
      flex: 1;
      height: 48px;
      border-radius: 14px;
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 16px;
      font-weight: 600;
      
      &::after { border: none; }
    }
    
    .cancel-btn {
      background-color: #f5f7fa;
      color: #666;
    }
    
    .confirm-btn {
      background: linear-gradient(135deg, #007aff, #005bb7);
      color: #fff;
    }
  }
}
</style>
