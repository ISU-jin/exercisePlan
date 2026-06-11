<template>
  <view class="container">
    <view class="status-bar"></view>
    
    <view class="header-section">
      <view class="title-wrapper">
        <text class="main-title">训练日历</text>
        <text class="sub-title">掌控您的训练节奏</text>
      </view>
    </view>

    <view class="calendar-wrapper">
      <uni-calendar
        :insert="true"
        :selected="selectedDates"
        @change="onDateChange"
        class="custom-calendar"
      ></uni-calendar>
    </view>

    <view class="detail-section">
      <view class="section-header">
        <text class="date-title">{{ displayDate }}</text>
        <view class="plan-indicator completed" v-if="selectedDayLogs.length > 0">
          <text>已完成训练</text>
        </view>
        <view class="plan-indicator" v-else-if="selectedDayPlan && !selectedDayPlan.isRest" :style="{ backgroundColor: getGroupColor(selectedDayPlan.target_group) + '1a', color: getGroupColor(selectedDayPlan.target_group) }">
          <text>{{ selectedDayPlan.target_group }}部训练计划</text>
        </view>
      </view>

      <view v-if="selectedDayLogs.length === 0 && !selectedDayPlan" class="empty-detail">
        <uni-icons type="info" size="40" color="#eee"></uni-icons>
        <text>该日暂无记录或计划</text>
      </view>

      <view v-else class="detail-card">
        <!-- 优先显示训练记录 -->
        <view v-if="selectedDayLogs.length > 0" class="workout-view">
          <view class="action-list">
            <view v-for="log in selectedDayLogs" :key="log.id" class="action-item">
              <view class="action-info">
                <text class="name">{{ log.action_name }}</text>
                <text class="target" v-if="log.category !== '有氧' && log.category !== '核心'">{{ log.weight }}kg x {{ log.reps }}次 x {{ log.sets }}组</text>
                <text class="target" v-else>{{ log.note || log.category + '训练' }}</text>
              </view>
              <uni-icons type="checkbox-filled" size="20" color="#007aff"></uni-icons>
            </view>
          </view>
        </view>

        <!-- 如果没有记录但有计划 -->
        <view v-else-if="selectedDayPlan">
          <view v-if="selectedDayPlan.isRest" class="rest-view">
            <view class="rest-icon">
              <uni-icons type="refresh-filled" size="48" color="#007aff"></uni-icons>
            </view>
            <text class="rest-text">休息日</text>
            <text class="rest-reason">{{ selectedDayPlan.reason }}</text>
          </view>
          
          <view v-else class="workout-view">
            <view class="action-list">
              <view v-for="actionId in selectedDayPlan.action_ids" :key="actionId" class="action-item">
                <view class="action-info">
                  <text class="name">{{ getActionName(actionId) }}</text>
                  <text class="target" v-if="getActionCategory(actionId) !== '有氧' && getActionCategory(actionId) !== '核心'">{{ selectedDayPlan.settings[actionId].reps }} 次 x {{ selectedDayPlan.settings[actionId].sets }} 组</text>
                  <text class="target" v-else>{{ getActionCategory(actionId) }}训练计划</text>
                </view>
                <uni-icons type="circle" size="20" color="#eee"></uni-icons>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { usePlanStore } from '@/stores/plan.js';
import { useExerciseStore } from '@/stores/exercise.js';
import { useLogStore } from '@/stores/log.js';

const planStore = usePlanStore();
const exerciseStore = useExerciseStore();
const logStore = useLogStore();

const selectedDateStr = ref(new Date().toISOString().split('T')[0]);
const selectedDayPlan = ref(null);
const selectedDayLogs = ref([]);
const loggedDatesMap = ref({});

// 定义部位显示优先级
const priorityOrder = ['胸', '背', '腿', '肩', '手臂', '核心', '有氧'];

const bestLogCategory = computed(() => {
  if (selectedDayLogs.value.length === 0) return '';
  const cats = selectedDayLogs.value.map(log => log.category);
  const sorted = [...new Set(cats)].sort((a, b) => {
    const indexA = priorityOrder.indexOf(a.split('-')[0]);
    const indexB = priorityOrder.indexOf(b.split('-')[0]);
    const pA = indexA === -1 ? 99 : indexA;
    const pB = indexB === -1 ? 99 : indexB;
    return pA - pB;
  });
  return sorted[0] || '';
});

const displayDate = computed(() => {
  const d = new Date(selectedDateStr.value);
  const weeks = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${d.getMonth() + 1}月${d.getDate()}日 ${weeks[d.getDay()]}`;
});

const groupColors = {
  '胸': '#ff4d4f',
  '背': '#52c41a',
  '腿': '#faad14',
  '肩': '#722ed1',
  '手臂': '#13c2c2',
  '核心': '#eb2f96',
  '有氧': '#fa8c16',
  '默认': '#007aff'
};

const getGroupColor = (group) => {
  if (!group) return groupColors['默认'];
  // 处理带子分类的情况，如 "肩-前束"
  const mainGroup = group.split('-')[0];
  return groupColors[mainGroup] || groupColors['默认'];
};

const selectedDates = computed(() => {
  const dates = [];
  
  // 1. 添加已完成的训练记录 (最高优先级)
   Object.keys(loggedDatesMap.value).forEach(date => {
      const categories = loggedDatesMap.value[date];
      // 根据优先级排序，取优先级最高的部位显示文字
      const sortedCategories = [...categories].sort((a, b) => {
        const indexA = priorityOrder.indexOf(a.split('-')[0]);
        const indexB = priorityOrder.indexOf(b.split('-')[0]);
        const pA = indexA === -1 ? 99 : indexA;
        const pB = indexB === -1 ? 99 : indexB;
        return pA - pB;
      });
      
      const info = sortedCategories.length > 0 ? sortedCategories[0] : '已练';
      dates.push({
        date,
        info: info,
        color: '#007aff',
        disable: false, // 显式设置
        isLogged: true  // 添加自定义标识用于样式区分
      });
    });

  // 2. 添加未来的计划内容 (如果不与已练记录冲突)
  if (planStore.activePlan && planStore.activePlan.split_type !== 0) {
    const start = new Date(planStore.activePlan.start_date);
    const end = new Date();
    end.setMonth(end.getMonth() + 2);
    
    let current = new Date(start);
    while (current <= end) {
      const dStr = current.toISOString().split('T')[0];
      // 如果这一天已经有训练记录了，就不显示计划内容（避免冲突）
      if (!loggedDatesMap.value[dStr]) {
        const plan = planStore.getPlanForDate(dStr);
        if (plan) {
          if (plan.isRest) {
            dates.push({ date: dStr, info: '休', color: '#999' });
          } else {
            dates.push({ 
              date: dStr, 
              info: plan.target_group, 
              color: getGroupColor(plan.target_group)
            });
          }
        }
      }
      current.setDate(current.getDate() + 1);
    }
  }
  
  return dates;
});

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

const onDateChange = async (e) => {
  selectedDateStr.value = e.fulldate;
  selectedDayLogs.value = await logStore.fetchLogsByDate(e.fulldate);
  
  if (planStore.activePlan && planStore.activePlan.split_type === 0) {
    selectedDayPlan.value = null;
  } else {
    selectedDayPlan.value = planStore.getPlanForDate(e.fulldate);
  }
};

onMounted(async () => {
  await exerciseStore.fetchActions();
  await planStore.fetchActivePlan();
  loggedDatesMap.value = await logStore.fetchAllLoggedDates();
  
  selectedDayLogs.value = await logStore.fetchLogsByDate(selectedDateStr.value);
  if (planStore.activePlan && planStore.activePlan.split_type === 0) {
    selectedDayPlan.value = null;
  } else {
    selectedDayPlan.value = planStore.getPlanForDate(selectedDateStr.value);
  }
});

watch(() => planStore.activePlan, async () => {
  loggedDatesMap.value = await logStore.fetchAllLoggedDates();
  if (planStore.activePlan && planStore.activePlan.split_type === 0) {
    selectedDayPlan.value = null;
  } else {
    selectedDayPlan.value = planStore.getPlanForDate(selectedDateStr.value);
  }
});

watch(() => planStore.adjustments, () => {
  if (planStore.activePlan && planStore.activePlan.split_type === 0) {
    selectedDayPlan.value = null;
  } else {
    selectedDayPlan.value = planStore.getPlanForDate(selectedDateStr.value);
  }
}, { deep: true });
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

.calendar-wrapper {
  background-color: #fff;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
  margin-bottom: 24px;
}

.custom-calendar {
  :deep(.uni-calendar__content) {
    background-color: #fff !important;
  }
  // 只针对带有特殊标识的已练日期进行样式覆盖
  :deep(.uni-calendar-item--extra) {
    font-weight: bold;
    // 这里的颜色会继承自 selectedDates 中的 color 属性，通常不需要强制覆盖
  }
}

.detail-section {
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    
    .date-title {
      font-size: 18px;
      font-weight: 800;
      color: #1a1a1a;
    }
    
    .plan-indicator {
      background-color: rgba(0, 122, 255, 0.1);
      color: #007aff;
      font-size: 12px;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 8px;

      &.completed {
        background-color: #eef6ff;
        color: #007aff;
      }
    }
  }
}

.empty-detail {
  padding: 60px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #ccc;
  font-size: 14px;
}

.detail-card {
  background-color: #fff;
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.02);
}

.rest-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
  
  .rest-icon {
    width: 80px;
    height: 80px;
    background-color: #f0f7ff;
    border-radius: 30px;
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 16px;
  }
  
  .rest-text {
    font-size: 18px;
    font-weight: 700;
    color: #333;
  }
  
  .rest-reason {
    font-size: 14px;
    color: #999;
    margin-top: 4px;
  }
}

.action-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.action-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background-color: #f8f9fb;
  border-radius: 16px;
  
  .name {
    font-size: 16px;
    font-weight: 700;
    color: #333;
    display: block;
  }
  
  .target {
    font-size: 13px;
    color: #999;
    margin-top: 4px;
    display: block;
  }
}
</style>
