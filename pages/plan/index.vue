<template>
  <view class="container">
    <view class="status-bar"></view>
    
    <view class="header-section">
      <view class="title-wrapper">
        <text class="main-title">计划配置</text>
        <text class="sub-title">设定您的训练周期与目标</text>
      </view>
    </view>

    <view class="config-section">
      <view class="config-card">
        <view class="config-item">
          <text class="label">分化方式</text>
          <view class="split-selector">
            <view 
              v-for="opt in splitOptions" 
              :key="opt.value"
              class="split-opt"
              :class="{ active: baseFormData.split_type === opt.value }"
              @click="handleSplitChange(opt.value)"
            >
              <text class="opt-text">{{ opt.label }}</text>
              <text class="opt-sub">{{ opt.sub }}</text>
            </view>
          </view>
        </view>

        <view class="config-row" v-if="baseFormData.split_type !== 0">
          <view class="config-item half">
            <text class="label">循环休整 (天)</text>
            <view class="number-stepper">
              <view class="step-btn" @click="baseFormData.rest_days = Math.max(0, baseFormData.rest_days - 1)">-</view>
              <input type="number" v-model="baseFormData.rest_days" />
              <view class="step-btn" @click="baseFormData.rest_days = Math.min(7, baseFormData.rest_days + 1)">+</view>
            </view>
          </view>
          <view class="config-item half">
            <text class="label">开始日期</text>
            <uni-datetime-picker type="date" v-model="baseFormData.start_date" :border="false">
              <view class="date-display">
                <text>{{ baseFormData.start_date }}</text>
                <uni-icons type="calendar" size="16" color="#007aff"></uni-icons>
              </view>
            </uni-datetime-picker>
          </view>
        </view>
      </view>
    </view>

    <view class="days-section">
      <view class="section-header">
        <text>{{ baseFormData.split_type === 0 ? '自由训练模板' : '动作编排' }}</text>
        <text class="helper">{{ baseFormData.split_type === 0 ? '设置您的常用训练动作' : '设置每一天的训练部位与动作' }}</text>
      </view>

      <view v-for="(day, index) in dayDetails" :key="index" class="day-card">
        <view class="day-card-header">
          <view class="day-index" v-if="baseFormData.split_type !== 0">DAY {{ index + 1 }}</view>
          <text class="target-group">{{ day.target_group }}{{ baseFormData.split_type === 0 ? '' : '部训练' }}</text>
        </view>
        
        <view class="day-card-body">
          <view v-if="day.action_ids.length === 0" class="empty-actions" @click="showActionPicker(index)">
            <uni-icons type="plus-filled" size="24" color="#007aff"></uni-icons>
            <text>添加动作</text>
          </view>
          
          <view v-else class="action-list">
            <view v-for="(actionId, aIndex) in day.action_ids" :key="aIndex" class="action-item">
              <view class="action-main">
                <text class="action-name">{{ getActionName(actionId) }}</text>
                <view class="action-controls" v-if="getActionCategory(actionId) !== '有氧' && getActionCategory(actionId) !== '核心'">
                  <view class="input-wrap">
                    <input type="number" v-model="day.settings[actionId].reps" />
                    <text>次</text>
                  </view>
                  <view class="input-wrap">
                    <input type="number" v-model="day.settings[actionId].sets" />
                    <text>组</text>
                  </view>
                </view>
                <view class="action-controls" v-else>
                  <text class="cardio-tip">{{ getActionCategory(actionId) }}运动：打卡时输入内容</text>
                </view>
              </view>
              <view class="remove-btn" @click="removeAction(index, aIndex)">
                <uni-icons type="trash" size="18" color="#999"></uni-icons>
              </view>
            </view>
            
            <button class="add-more-btn" @click="showActionPicker(index)">
              <uni-icons type="plus" size="16" color="#007aff"></uni-icons>
              <text>继续添加动作</text>
            </button>
          </view>
        </view>
      </view>
    </view>

    <view class="footer-section">
      <button class="save-btn" @click="savePlan">保存并激活新计划</button>
      <text class="footer-tip">激活新计划将清除之前的顺延记录</text>
    </view>

    <!-- 动作选择弹窗 -->
    <uni-popup ref="actionPopup" type="bottom">
      <view class="modern-picker">
        <view class="picker-header">
          <view class="drag-handle"></view>
          <view class="header-content">
            <text class="title">选择动作</text>
            <text class="subtitle">可跨部位选择动作</text>
          </view>
          <view class="close-btn" @click="actionPopup.close()">
            <uni-icons type="closeempty" size="20" color="#999"></uni-icons>
          </view>
        </view>
        
        <!-- 弹窗内的分类选择 -->
        <scroll-view class="picker-cat-scroll" scroll-x="true" show-scrollbar="false">
          <view 
            v-for="cat in pickerCategories" 
            :key="cat" 
            class="cat-item"
            :class="{ active: pickerCurrentCat === cat }"
            @click="pickerCurrentCat = cat"
          >{{ cat }}</view>
        </scroll-view>

        <scroll-view scroll-y="true" class="picker-body">
          <view v-if="filteredPickerActions.length === 0" class="empty-picker">
            <uni-icons type="info" size="48" color="#eee"></uni-icons>
            <text>暂无该部位动作</text>
            <button class="go-lib-btn" @click="goToExerciseLibrary">前往库中添加</button>
          </view>
          <view v-else class="picker-grid">
            <view 
              v-for="action in filteredPickerActions" 
              :key="action.id" 
              class="picker-card"
              :class="{ selected: dayDetails[currentDayIndex]?.action_ids.includes(action.id) }"
              @click="selectAction(action)"
            >
              <view class="action-info">
                <text class="name">{{ action.name }}</text>
                <text class="sub">{{ action.category }}</text>
              </view>
              <uni-icons :type="dayDetails[currentDayIndex]?.action_ids.includes(action.id) ? 'checkbox-filled' : 'plus'" size="20" :color="dayDetails[currentDayIndex]?.action_ids.includes(action.id) ? '#007aff' : '#999'"></uni-icons>
            </view>
          </view>
        </scroll-view>
      </view>
    </uni-popup>
  </view>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { usePlanStore } from '@/stores/plan.js';
import { useExerciseStore } from '@/stores/exercise.js';

const planStore = usePlanStore();
const exerciseStore = useExerciseStore();

const splitOptions = [
  { value: 3, label: '三分化', sub: '胸 / 背 / 腿' },
  { value: 5, label: '五分化', sub: '胸 / 背 / 肩 / 腿 / 臂' },
  { value: 0, label: '自由训练', sub: '自定义动作模板' }
];

const baseFormData = reactive({
  split_type: 3,
  rest_days: 1,
  start_date: new Date().toISOString().split('T')[0]
});

const dayDetails = ref([]);
const currentDayIndex = ref(-1);
const actionPopup = ref(null);

// 弹窗内部的分类逻辑
const pickerCategories = ['全部', '胸', '背', '腿', '肩', '手臂', '核心', '有氧'];
const pickerCurrentCat = ref('全部');

const filteredPickerActions = computed(() => {
  if (pickerCurrentCat.value === '全部') return exerciseStore.actions;
  const list = exerciseStore.actions.filter(a => a.category.startsWith(pickerCurrentCat.value));
  
  // 如果是核心或有氧，且库里没动作，提供一个默认占位
  if (list.length === 0) {
    if (pickerCurrentCat.value === '核心') return [{ id: -2, name: '核心训练', category: '核心' }];
    if (pickerCurrentCat.value === '有氧') return [{ id: -1, name: '有氧训练', category: '有氧' }];
  }
  return list;
});

onMounted(async () => {
  await exerciseStore.fetchActions();
  await planStore.fetchActivePlan();
  
  if (planStore.activePlan) {
    baseFormData.split_type = planStore.activePlan.split_type;
    baseFormData.rest_days = planStore.activePlan.rest_days;
    baseFormData.start_date = planStore.activePlan.start_date;
    dayDetails.value = JSON.parse(JSON.stringify(planStore.planDetails));
  } else {
    initDayDetails(3);
  }
});

const initDayDetails = (type) => {
  let groups = [];
  if (type === 3) groups = ['胸', '背', '腿'];
  else if (type === 5) groups = ['胸', '背', '肩', '腿', '臂'];
  else if (type === 0) groups = ['自由训练模板'];

  dayDetails.value = groups.map((group, index) => ({
    day_index: index,
    target_group: group,
    action_ids: [],
    settings: {}
  }));
};

const handleSplitChange = (val) => {
  if (baseFormData.split_type === val) return;
  uni.showModal({
    title: '切换分化',
    content: '切换分化将重置当前已编排的动作，确定继续吗？',
    success: (res) => {
      if (res.confirm) {
        baseFormData.split_type = val;
        initDayDetails(val);
      }
    }
  });
};

const getActionName = (id) => {
  if (id === -1) return '有氧训练';
  if (id === -2) return '核心训练';
  const action = exerciseStore.actions.find(a => a.id === id);
  return action ? action.name : '未知动作';
};

const getActionCategory = (id) => {
  if (id === -1) return '有氧';
  if (id === -2) return '核心';
  const action = exerciseStore.actions.find(a => a.id === id);
  return action ? action.category : '';
};

const showActionPicker = (dayIndex) => {
  currentDayIndex.value = dayIndex;
  // 默认选中当前天的部位分类
  const targetGroup = dayDetails.value[dayIndex].target_group;
  pickerCurrentCat.value = pickerCategories.includes(targetGroup) ? targetGroup : '全部';
  actionPopup.value.open();
};

const selectAction = (action) => {
  const day = dayDetails.value[currentDayIndex.value];
  const idx = day.action_ids.indexOf(action.id);
  if (idx > -1) {
    day.action_ids.splice(idx, 1);
    delete day.settings[action.id];
  } else {
    day.action_ids.push(action.id);
    if (action.category === '有氧' || action.category === '核心') {
      day.settings[action.id] = { note: '' };
    } else {
      day.settings[action.id] = { sets: 4, reps: 12 };
    }
  }
};

const removeAction = (dayIndex, actionIndex) => {
  const day = dayDetails.value[dayIndex];
  const actionId = day.action_ids[actionIndex];
  day.action_ids.splice(actionIndex, 1);
  delete day.settings[actionId];
};

const savePlan = async () => {
  for (const day of dayDetails.value) {
    if (day.action_ids.length === 0) {
      const msg = baseFormData.split_type === 0 ? '请为模板添加动作' : `请为${day.target_group}日添加动作`;
      uni.showToast({ title: msg, icon: 'none' });
      return;
    }
  }

  try {
    await planStore.savePlan(baseFormData, dayDetails.value);
    uni.showToast({ title: '已生效' });
    setTimeout(() => {
      uni.switchTab({ url: '/pages/index/index' });
    }, 1500);
  } catch (e) {
    console.error('Save plan failed', e);
    uni.showToast({ title: '保存失败', icon: 'none' });
  }
};

const goToExerciseLibrary = () => {
  actionPopup.value.close();
  uni.switchTab({ url: '/pages/exercise/index' });
};
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background-color: #f8f9fb;
  padding: 0 20px 120px;
}

.status-bar {
  height: var(--status-bar-height);
}

.header-section {
  padding: 15px 0 10px;
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
}

.config-card {
  background-color: #fff;
  border-radius: 20px;
  padding: 20px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.02);
  
  .config-item {
    margin-bottom: 20px;
    &:last-child { margin-bottom: 0; }
    
    .label {
      font-size: 13px;
      font-weight: 700;
      color: #333;
      margin-bottom: 12px;
      display: block;
    }
  }
}

.split-selector {
  display: flex;
  gap: 12px;
  
  .split-opt {
    flex: 1;
    background-color: #f5f7fa;
    padding: 12px;
    border-radius: 12px;
    border: 2px solid transparent;
    transition: all 0.2s;
    
    .opt-text {
      font-size: 15px;
      font-weight: 700;
      color: #333;
      display: block;
    }
    
    .opt-sub {
      font-size: 11px;
      color: #999;
      margin-top: 2px;
    }
    
    &.active {
      background-color: #f0f7ff;
      border-color: #007aff;
      .opt-text { color: #007aff; }
    }
  }
}

.config-row {
  display: flex;
  gap: 16px;
  .half { flex: 1; }
}

.number-stepper {
  display: flex;
  background-color: #f5f7fa;
  border-radius: 12px;
  height: 44px;
  align-items: center;
  overflow: hidden;
  
  .step-btn {
    width: 44px;
    height: 44px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 20px;
    color: #666;
    font-weight: bold;
  }
  
  input {
    flex: 1;
    text-align: center;
    font-weight: 700;
    color: #333;
  }
}

.date-display {
  background-color: #f5f7fa;
  border-radius: 12px;
  height: 44px;
  padding: 0 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  font-size: 14px;
  color: #333;
}

.days-section {
  margin-top: 32px;
  
  .section-header {
    margin-bottom: 16px;
    text {
      font-size: 18px;
      font-weight: 800;
      color: #1a1a1a;
      display: block;
    }
    .helper {
      font-size: 12px;
      color: #999;
      margin-top: 4px;
      font-weight: normal;
    }
  }
}

.day-card {
  background-color: #fff;
  border-radius: 20px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.02);
  
  .day-card-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    
    .day-index {
      font-size: 10px;
      font-weight: 800;
      background-color: #1a1a1a;
      color: #fff;
      padding: 2px 8px;
      border-radius: 6px;
    }
    
    .target-group {
      font-size: 16px;
      font-weight: 700;
      color: #1a1a1a;
    }
  }
}

.empty-actions {
  height: 80px;
  border: 2px dashed #eee;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 8px;
  color: #007aff;
  font-size: 14px;
  font-weight: 600;
}

.action-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background-color: #f8f9fb;
  border-radius: 12px;
  margin-bottom: 10px;
  
  .action-main {
    flex: 1;
  }
  
  .action-name {
    font-size: 15px;
    font-weight: 700;
    color: #333;
    display: block;
    margin-bottom: 8px;
  }
  
  .action-controls {
    display: flex;
    gap: 12px;
    
    .input-wrap {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #999;
      
      input {
        width: 40px;
        height: 28px;
        background-color: #fff;
        border-radius: 6px;
        text-align: center;
        font-weight: 700;
        color: #333;
      }
    }
    
    .cardio-tip {
      font-size: 12px;
      color: #007aff;
      font-weight: 600;
    }
  }
  
  .remove-btn {
    width: 32px;
    height: 32px;
    display: flex;
    justify-content: center;
    align-items: center;
  }
}

.add-more-btn {
  margin-top: 10px;
  background-color: transparent;
  color: #007aff;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  &::after { border: none; }
}

.footer-section {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: #fff;
  padding: 20px 20px calc(20px + var(--window-bottom));
  box-shadow: 0 -8px 20px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
  
  .save-btn {
    width: 100%;
    height: 54px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #007aff, #005bb7);
    color: #fff;
    border-radius: 16px;
    font-weight: 700;
    font-size: 16px;
    line-height: 1;
    box-shadow: 0 8px 20px rgba(0, 122, 255, 0.2);
    &::after { border: none; }
  }
  
  .footer-tip {
    font-size: 11px;
    color: #999;
    margin-top: 10px;
  }
}

.modern-picker {
  background-color: #fff;
  border-radius: 30px 30px 0 0;
  height: 80vh;
  display: flex;
  flex-direction: column;
  
  .picker-header {
    padding: 10px 24px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: relative;
    
    .drag-handle {
      position: absolute;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      width: 40px;
      height: 4px;
      background-color: #eee;
      border-radius: 2px;
    }
    
    .header-content {
      margin-top: 15px;
      .title {
        font-size: 20px;
        font-weight: 800;
        color: #1a1a1a;
      }
      .subtitle {
        font-size: 13px;
        color: #999;
        display: block;
      }
    }
  }

  .picker-cat-scroll {
    white-space: nowrap;
    padding: 0 20px 15px;
    .cat-item {
      display: inline-block;
      padding: 4px 12px;
      margin-right: 8px;
      background-color: #f5f7fa;
      border-radius: 12px;
      font-size: 12px;
      color: #666;
      &.active {
        background-color: #007aff;
        color: #fff;
      }
    }
  }
  
  .picker-body {
    flex: 1;
    padding: 0 20px;
    box-sizing: border-box;
  }
  
  .picker-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    padding-bottom: 40px;
  }
  
  .picker-card {
    background-color: #f8f9fb;
    padding: 12px;
    border-radius: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border: 2px solid transparent;
    
    .name {
      font-size: 14px;
      font-weight: 700;
      color: #333;
      display: block;
    }
    .sub {
      font-size: 10px;
      color: #999;
      margin-top: 2px;
    }
    
    &.selected {
      background-color: #f0f7ff;
      border-color: #007aff;
      .name { color: #007aff; }
    }
  }
  
  .empty-picker {
    padding: 60px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    color: #999;
    
    .go-lib-btn {
      margin-top: 20px;
      background-color: #f0f7ff;
      color: #007aff;
      font-size: 14px;
      padding: 0 24px;
      border-radius: 12px;
      &::after { border: none; }
    }
  }
}
</style>
