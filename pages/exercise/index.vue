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
        <view v-for="action in filteredActions" :key="action.id" class="action-card">
          <view class="card-left">
            <view class="category-tag">{{ action.category }}</view>
            <text class="action-name">{{ action.name }}</text>
          </view>
          <view class="card-right">
            <view class="icon-btn delete" @click="confirmDelete(action)">
              <uni-icons type="trash" size="20" color="#ff4d4f"></uni-icons>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 新增动作弹窗 -->
    <uni-popup ref="addPopup" type="center">
      <view class="modern-dialog">
        <view class="dialog-header">
          <text>新增动作</text>
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
          <view class="input-item" v-if="newCategory !== '有氧'">
            <text class="label">动作名称</text>
            <uni-easyinput 
              v-model="newName" 
              placeholder="例如: 杠铃卧推" 
              :inputBorder="false"
              class="custom-input"
            ></uni-easyinput>
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
const newName = ref('');
const newCategory = ref('');
const currentCat = ref('全部');
const searchKeyword = ref('');

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
  newName.value = '';
  // 如果当前选了分类且不是“全部”，则默认为该分类
  if (currentCat.value !== '全部') {
    newCategory.value = currentCat.value;
  } else {
    newCategory.value = '';
  }
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
  await exerciseStore.addAction(newName.value, newCategory.value);
  addPopup.value.close();
  uni.showToast({ title: '添加成功' });
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

  .category-tag {
    font-size: 10px;
    background-color: #eef6ff;
    color: #007aff;
    padding: 2px 8px;
    border-radius: 4px;
    width: fit-content;
    font-weight: bold;
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
