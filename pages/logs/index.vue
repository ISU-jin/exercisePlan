<template>
  <view class="container">
    <view class="status-bar"></view>
    
    <view class="header-section">
      <view class="title-wrapper">
        <text class="main-title">运动记录</text>
        <view class="filter-status" v-if="filterDate">
          <text class="filter-tag">{{ filterDate }} 筛选中</text>
        </view>
        <text v-else class="sub-title">回顾您的每一次进步</text>
      </view>
      <view class="header-actions">

        <view v-if="filterDate" class="action-btn clear" @click="clearFilter">
          <uni-icons type="refreshempty" size="20" color="#ff4d4f"></uni-icons>
        </view>
        <uni-datetime-picker type="date" v-model="filterDate" @change="onDateSelect" :border="false" :end="todayStr">
          <view class="action-btn calendar" :class="{ active: filterDate }">
            <uni-icons type="calendar" size="20" :color="filterDate ? '#fff' : '#007aff'"></uni-icons>
          </view>
        </uni-datetime-picker>
        <view class="action-btn chart" @click="goToStatistics">
          <image src="/static/statistics.svg" style="width: 20px; height: 20px;"></image>
        </view>
      </view>
    </view>

    <view class="content-body">
      <view v-if="groupedLogs.length === 0" class="empty-state">
        <uni-icons type="info" size="48" color="#eee"></uni-icons>
        <text>尚未有运动记录</text>
        <text class="empty-sub">开启您的第一场训练吧</text>
      </view>

      <view v-else class="log-list">
        <view v-for="group in groupedLogs" :key="group.date" class="log-group-card" @click="showEditPopup(group)">
          <view class="group-header">
            <view class="date-info">
              <text class="day">{{ getDay(group.date) }}</text>
              <view class="date-bottom">
                <text class="month-year">{{ getMonthYear(group.date) }}</text>
                <view v-if="group.totalVolume > 0" class="daily-volume-tag">
                  <text class="v-label">训练量:</text>
                  <text class="v-value">{{ group.totalVolume }}</text>
                </view>
              </view>
            </view>
            <view class="edit-hint">
              <uni-icons type="compose" size="16" color="#007aff"></uni-icons>
              <text>编辑</text>
            </view>
          </view>
          
          <view class="cat-groups">
            <view v-for="cat in group.categoryList" :key="cat.name" class="cat-sub-group">
              <view class="cat-title" :style="{ color: getCatColor(cat.name) }">
                <view class="dot" :style="{ backgroundColor: getCatColor(cat.name) }"></view>
                <text>{{ cat.name }}</text>
              </view>
              
              <view class="action-items">
                <view v-for="(action, index) in cat.actions" :key="index" class="action-item">
                  <view class="action-main">
                    <view class="action-title-row">
                      <text class="action-name">{{ action.action_name }}</text>
                      <text class="action-set-tag">{{ action.sets }}组</text>
                    </view>
                    
                    <view v-if="action.category === '有氧' || action.category === '核心'" class="cardio-note">
                      <text>{{ action.note || '未填写内容' }}</text>
                    </view>
                    <view v-else-if="action.is_all_same" class="action-data-horizontal">
                      <view class="data-item">
                        <text class="label">重量:</text>
                        <text class="value weight">{{ action.weights_list[0] }}</text>
                        <text class="unit">KG</text>
                      </view>
                      <view class="data-divider"></view>
                      <view class="data-item">
                        <text class="label">次数:</text>
                        <text class="value reps">{{ action.reps_list[0] }}</text>
                        <text class="unit">次</text>
                      </view>
                    </view>
                    <view v-else class="action-data-vertical">
                      <view class="data-row">
                        <text class="row-label">重量:</text>
                        <view class="row-values">
                          <text v-for="(w, wIdx) in action.weights_list" :key="wIdx" class="val-item weight">{{ w }}</text>
                        </view>
                        <text class="row-unit">KG</text>
                      </view>
                      <view class="data-row">
                        <text class="row-label">次数:</text>
                        <view class="row-values">
                          <text v-for="(r, rIdx) in action.reps_list" :key="rIdx" class="val-item reps">{{ r }}</text>
                        </view>
                        <text class="row-unit">次</text>

                      </view>
                    </view>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>
        
        <uni-load-more :status="loadStatus" @clickLoadMore="loadMore" class="custom-load-more"></uni-load-more>
      </view>
    </view>

    <!-- 编辑弹窗 (复用打卡弹窗样式) -->
    <uni-popup ref="logPopup" type="bottom">
      <view class="modern-log-popup">
        <view class="popup-header">
          <view class="drag-handle"></view>
          <view class="header-content">
            <text class="title">编辑训练记录</text>
            <view class="date-picker-wrap">
              <text class="date-trigger">{{ logDate }}</text>
              <text class="subtitle">· {{ logActions.length }} 个动作</text>
            </view>
          </view>
          <view class="close-btn" @click="logPopup.close()">
            <uni-icons type="closeempty" size="20" color="#999"></uni-icons>
          </view>
        </view>
        
        <scroll-view scroll-y="true" class="popup-body" :scroll-top="scrollTop" scroll-with-animation>
          <view v-for="(action, index) in logActions" :key="index" class="log-card">
            <view class="log-card-header">
              <view class="header-left">
                <text class="name">{{ action.name }}</text>
              </view>
              <view class="header-right" @click="removeLogAction(index)">
                <uni-icons type="trash" size="20" color="#ff4d4f"></uni-icons>
              </view>
            </view>
            
            <!-- 有氧/核心特殊 UI -->
            <view v-if="action.category === '有氧' || action.category === '核心'" class="cardio-input">
              <textarea 
                v-model="action.note" 
                :placeholder="'在此输入' + action.category + '内容'" 
                auto-height
              ></textarea>
            </view>
            
            <!-- 力量训练 UI -->
            <view v-else class="log-inputs">
              <view class="input-main-row">
                <view class="input-box">
                  <text class="label">实际组数</text>
                  <input type="number" v-model="action.sets" @input="onSetsChange(action)" />
                </view>
                <view v-if="!action.isMultiSet" class="input-box weight">
                  <text class="label">重量 (KG)</text>
                  <input type="digit" v-model="action.weight" />
                </view>
                <view class="multi-toggle" @click="action.isMultiSet = !action.isMultiSet">
                  <uni-icons :type="action.isMultiSet ? 'checkbox-filled' : 'checkbox'" size="20" :color="action.isMultiSet ? '#007aff' : '#ccc'"></uni-icons>
                  <text :class="{ active: action.isMultiSet }">详细记录</text>
                </view>
              </view>

              <view v-if="!action.isMultiSet" class="input-box single-reps">
                <text class="label">实际次数</text>
                <input type="number" v-model="action.reps" />
              </view>
              
              <view v-else class="multi-reps-container">
                <text class="label">每组重量与次数录入</text>
                <view class="multi-reps-wrapper">
                  <view class="side-labels">
                    <text class="side-label">重量</text>
                    <text class="side-label">次数</text>
                  </view>
                  <scroll-view scroll-x class="multi-reps-scroll">
                    <view class="multi-reps-grid">
                      <view v-for="sIndex in Number(action.sets)" :key="sIndex" class="multi-reps-item detail-mode">
                        <text class="set-label">第{{ sIndex }}组</text>
                        <view class="detail-inputs">
                          <input type="digit" v-model="action.multiWeights[sIndex-1]" class="multi-input weight" placeholder="重量" />
                          <input type="number" v-model="action.multiReps[sIndex-1]" class="multi-input reps" placeholder="次数" />
                        </view>
                      </view>
                    </view>
                  </scroll-view>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>
        
        <view class="popup-footer">
          <view class="quick-add-row">
            <text class="quick-label">快捷添加:</text>
            <view class="quick-chip" @click="addExtraAction({ id: -2, name: '自定义核心', category: '核心' }, false)">
              <uni-icons type="plus" size="12" color="#007aff"></uni-icons>
              <text>核心</text>
            </view>
            <view class="quick-chip" @click="addExtraAction({ id: -1, name: '自定义有氧', category: '有氧' }, false)">
              <uni-icons type="plus" size="12" color="#007aff"></uni-icons>
              <text>有氧</text>
            </view>
          </view>
          <view class="footer-btns">
            <button class="add-action-btn" @click="showActionPicker">
              <uni-icons type="plus" size="20" color="#007aff"></uni-icons>
              <text>添加动作</text>
            </button>
            <button class="submit-btn" @click="submitLog">保存修改</button>
          </view>
        </view>
      </view>
    </uni-popup>

    <!-- 动作选择弹窗 -->
    <uni-popup ref="actionPopup" type="bottom">
      <view class="modern-picker">
        <view class="picker-header">
          <view class="drag-handle"></view>
          <view class="header-content">
            <text class="title">选择动作</text>
            <text class="subtitle">增加动作记录</text>
          </view>
          <view class="close-btn" @click="actionPopup.close()">
            <uni-icons type="closeempty" size="20" color="#999"></uni-icons>
          </view>
        </view>
        
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
          <view class="picker-grid">
            <view 
              v-for="action in filteredPickerActions" 
              :key="action.id" 
              class="picker-card"
              @click="addExtraAction(action)"
            >
              <view class="action-info">
                <text class="name">{{ action.name }}</text>
                <text class="sub">{{ action.category }}</text>
              </view>
              <uni-icons type="plus" size="20" color="#999"></uni-icons>
            </view>
          </view>
        </scroll-view>
      </view>
    </uni-popup>
  </view>
</template>

<script setup>
import { ref, onMounted, computed, getCurrentInstance, nextTick } from 'vue';
import { onHide, onReachBottom } from '@dcloudio/uni-app';
import { useLogStore } from '@/stores/log.js';
import { useExerciseStore } from '@/stores/exercise.js';
import { usePlanStore } from '@/stores/plan.js';

const logStore = useLogStore();
const exerciseStore = useExerciseStore();
const planStore = usePlanStore();
const instance = getCurrentInstance();

const todayStr = new Date().toISOString().split('T')[0];
const loadStatus = ref('more');
const page = ref(0);
const pageSize = 20;

// 筛选相关
const filterDate = ref('');

// 编辑相关状态
const logPopup = ref(null);
const actionPopup = ref(null);
const logActions = ref([]);
const logDate = ref('');
const scrollTop = ref(0);
const pickerCategories = ['全部', '胸', '背', '腿', '肩', '手臂', '核心', '有氧'];
const pickerCurrentCat = ref('全部');

const filteredPickerActions = computed(() => {
  let list = exerciseStore.actions;
  if (pickerCurrentCat.value !== '全部') {
    list = list.filter(a => a.category.startsWith(pickerCurrentCat.value));
  }
  if (pickerCurrentCat.value === '有氧' && list.length === 0) {
    return [{ id: -1, name: '自定义有氧', category: '有氧' }];
  }
  if (pickerCurrentCat.value === '核心' && list.length === 0) {
    return [{ id: -2, name: '自定义核心', category: '核心' }];
  }
  return list;
});

const groupedLogs = computed(() => {
  const groups = {};
  logStore.logs.forEach(log => {
    if (!groups[log.date]) {
      groups[log.date] = {
        date: log.date,
        categories: {},
        totalVolume: 0
      };
    }
    
    // 计算单项动作训练量
    let volume = 0;
    const reps = Number(log.reps) || 0;
    const sets = Number(log.sets) || 0;
    const weight = Number(log.weight) || 0;
    const repsDetail = log.reps_detail || '';
    const weightDetail = log.weight_detail || '';
    
    if (repsDetail) {
      // 兼容旧的 JSON 数组格式和新的逗号分隔格式
      let repsArray = [];
      if (repsDetail.startsWith('[')) {
        try {
          repsArray = JSON.parse(repsDetail).map(Number);
        } catch (e) {
          repsArray = repsDetail.replace(/[\[\]]/g, '').split(',').map(Number);
        }
      } else {
        repsArray = repsDetail.split(',').map(Number);
      }

      let weightsArray = [];
      if (weightDetail) {
        weightsArray = weightDetail.split(',').map(Number);
      } else {
        weightsArray = Array(repsArray.length).fill(weight);
      }

      // 计算总训练量：每组次数 * 每组重量
      let currentVolume = 0;
      repsArray.forEach((r, i) => {
        currentVolume += (Number(r) || 0) * (Number(weightsArray[i]) || Number(weightsArray[0]) || 0);
      });
      volume = currentVolume;
    } else {
      volume = sets * reps * weight;
    }
    groups[log.date].totalVolume += volume;

    const cat = log.category || '其他';
    if (!groups[log.date].categories[cat]) {
      groups[log.date].categories[cat] = [];
    }

    // 格式化展示数据
     let displaySets = [];
     let repsArray = [];
     let weightsArray = [];

     if (repsDetail) {
       repsArray = repsDetail.split(',').filter(v => v !== '').map(Number);
       weightsArray = weightDetail ? weightDetail.split(',').filter(v => v !== '').map(Number) : Array(repsArray.length).fill(weight);
       
       repsArray.forEach((r, i) => {
         displaySets.push({
           reps: r,
           weight: weightsArray[i] !== undefined ? weightsArray[i] : (weightsArray[0] !== undefined ? weightsArray[0] : 0)
         });
       });
     } else {
       repsArray = Array(sets).fill(reps);
       weightsArray = Array(sets).fill(weight);
       for (let i = 0; i < sets; i++) {
         displaySets.push({
           reps: reps,
           weight: weight
         });
       }
     }
     
     log.reps_list = repsArray;
     log.weights_list = weightsArray;
     log.is_all_same = repsArray.every(r => r === repsArray[0]) && weightsArray.every(w => w === weightsArray[0]);

     groups[log.date].categories[cat].push(log);
   });
  
  return Object.values(groups).map(group => ({
    ...group,
    totalVolume: Math.round(group.totalVolume),
    categoryList: Object.keys(group.categories).map(catName => ({
      name: catName,
      actions: group.categories[catName]
    }))
  })).sort((a, b) => b.date.localeCompare(a.date));
});

const getCatColor = (cat) => {
  const colors = {
    '胸': '#ff4d4f',
    '背': '#1890ff',
    '腿': '#722ed1',
    '肩': '#fa8c16',
    '手臂': '#eb2f96',
    '核心': '#52c41a',
    '有氧': '#13c2c2',
    '其他': '#8c8c8c'
  };
  // 匹配前缀
  for (let key in colors) {
    if (cat.startsWith(key)) return colors[key];
  }
  return colors['其他'];
};

const getDay = (dateStr) => {
  return dateStr.split('-')[2];
};

const getMonthYear = (dateStr) => {
  const parts = dateStr.split('-');
  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  return `${months[parseInt(parts[1]) - 1]} ${parts[0]}`;
};

const fetchLogs = async (isRefresh = false) => {
  if (isRefresh) {
    page.value = 0;
    loadStatus.value = 'loading';
  }
  
  await logStore.fetchLogs(pageSize, page.value * pageSize, filterDate.value);
  
  if (logStore.logs.length < (page.value + 1) * pageSize) {
    loadStatus.value = 'noMore';
  } else {
    loadStatus.value = 'more';
  }
};

onMounted(() => {
  fetchLogs(true);
  exerciseStore.fetchActions();
});

onHide(() => {
  if (logPopup.value) logPopup.value.close();
  if (actionPopup.value) actionPopup.value.close();
});

onReachBottom(() => {
  loadMore();
});

const loadMore = () => {
  if (loadStatus.value === 'more') {
    loadStatus.value = 'loading';
    page.value++;
    fetchLogs();
  }
};

const onDateSelect = (date) => {
  if (date) {
    fetchLogs(true);
  }
};

const clearFilter = () => {
  filterDate.value = '';
  fetchLogs(true);
};

const goToStatistics = () => {
  uni.navigateTo({
    url: '/pages/logs/statistics'
  });
};

// 编辑功能方法
const showEditPopup = (group) => {
  logDate.value = group.date;
  logActions.value = [];
  
  // 展平所有分类下的动作
  group.categoryList.forEach(cat => {
    cat.actions.forEach(action => {
      const isMultiSet = !!(action.reps_detail || action.weight_detail);
      
      let multiReps = [];
      if (action.reps_detail) {
        if (action.reps_detail.startsWith('[')) {
          try {
            multiReps = JSON.parse(action.reps_detail).map(Number);
          } catch (e) {
            multiReps = action.reps_detail.replace(/[\[\]]/g, '').split(',').map(Number);
          }
        } else {
          multiReps = action.reps_detail.split(',').map(Number);
        }
      } else {
        multiReps = Array(action.sets || 4).fill(action.reps || 12);
      }

      let multiWeights = [];
      if (action.weight_detail) {
        multiWeights = action.weight_detail.split(',').map(Number);
      } else {
        multiWeights = Array(action.sets || 4).fill(action.weight || 0);
      }
      
      logActions.value.push({
        id: action.action_id,
        name: action.action_name,
        category: action.category,
        sets: action.sets,
        reps: action.reps,
        weight: action.weight,
        note: action.note || '',
        isPreset: false, // 编辑时都视为非预设
        isMultiSet: isMultiSet,
        multiReps: multiReps,
        multiWeights: multiWeights
      });
    });
  });
  
  logPopup.value.open();
};

const scrollToBottom = () => {
  nextTick(() => {
    scrollTop.value = logActions.value.length * 500;
  });
};

const onSetsChange = (action) => {
  const sets = parseInt(action.sets) || 0;
  
  // 处理次数数组
  if (sets > action.multiReps.length) {
    const lastVal = action.multiReps[action.multiReps.length - 1] || action.reps || 12;
    for (let i = action.multiReps.length; i < sets; i++) {
      action.multiReps.push(lastVal);
    }
  } else if (sets < action.multiReps.length) {
    action.multiReps = action.multiReps.slice(0, sets);
  }

  // 处理重量数组
  if (!action.multiWeights) action.multiWeights = [];
  if (sets > action.multiWeights.length) {
    const lastVal = action.multiWeights[action.multiWeights.length - 1] || action.weight || 0;
    for (let i = action.multiWeights.length; i < sets; i++) {
      action.multiWeights.push(lastVal);
    }
  } else if (sets < action.multiWeights.length) {
    action.multiWeights = action.multiWeights.slice(0, sets);
  }
};

const removeLogAction = (index) => {
  logActions.value.splice(index, 1);
};

const showActionPicker = () => {
  actionPopup.value.open();
};

const addExtraAction = async (action, shouldClosePopup = true) => {
  const lastWeight = action.id > 0 ? await logStore.fetchLastWeight(action.id) : 0;
  logActions.value.push({
    id: action.id > 0 ? action.id : 0,
    name: action.name,
    category: action.category,
    sets: 4,
    reps: 12,
    weight: lastWeight || 0,
    note: '',
    isPreset: false,
    isMultiSet: false,
    multiReps: Array(4).fill(12),
    multiWeights: Array(4).fill(lastWeight || 0)
  });
  if (shouldClosePopup) {
    actionPopup.value.close();
  } else {
    uni.showToast({ title: `已添加${action.category}`, icon: 'none', duration: 1000 });
  }
  scrollToBottom();
};

const submitLog = async () => {
  if (logActions.value.length === 0) {
    uni.showModal({
      title: '删除记录',
      content: '是否删除该日所有运动记录？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await logStore.updateWorkoutByDate(logDate.value, []);
            logPopup.value.close();
            uni.showToast({ title: '记录已删除' });
            fetchLogs(true);
          } catch (e) {
            uni.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
    return;
  }

  try {
    const actionsToSave = logActions.value.map(action => {
      const data = { ...action };
      if (action.isMultiSet) {
        if (action.multiReps && action.multiReps.length > 0) {
          data.reps_detail = action.multiReps.join(',');
          data.reps = action.multiReps[0] || action.reps;
        }
        if (action.multiWeights && action.multiWeights.length > 0) {
          data.weight_detail = action.multiWeights.join(',');
          // 计算平均重量用于显示
          const totalW = action.multiWeights.reduce((a, b) => a + (Number(b) || 0), 0);
          data.weight = (totalW / action.multiWeights.length).toFixed(1);
        }
      } else {
        data.reps_detail = '';
        data.weight_detail = '';
      }
      return data;
    });
    await logStore.updateWorkoutByDate(logDate.value, actionsToSave);
    logPopup.value.close();
    uni.showToast({ title: '记录已更新' });
    fetchLogs(true);
  } catch (e) {
    uni.showToast({ title: '保存失败', icon: 'none' });
  }
};
</script>

<style lang="scss" scoped>
.container {
  padding: 0 20px 20px;
}

.status-bar {
  height: var(--status-bar-height);
}

.header-section {
  padding: 10px 0 5px;
  display: flex;
  justify-content: space-between;
  align-items: center;

  .main-title {
    font-size: 24px;
    font-weight: 800;
    color: #1a1a1a;
    display: block;
  }

  .sub-title {
    font-size: 13px;
    color: #999;
    margin-top: 2px;
  }

  .filter-status {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
    
    .filter-tag {
      font-size: 12px;
      color: #007aff;
      background-color: #f0f7ff;
      padding: 2px 8px;
      border-radius: 6px;
      font-weight: 700;
    }
  }

  .header-actions {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .action-btn {
    width: 44px;
    height: 44px;
    background-color: #fff;
    border-radius: 14px;
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
    transition: all 0.3s;

    &.chart {
      background-color: #e6f7ff;
      border: 1px solid #0c9bdd;
    }

    &.calendar.active {
      background: linear-gradient(135deg, #007aff, #005bb7);
      box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
    }

    &.clear {
      background-color: #fff1f0;
      border: 1px solid #ffa39e;
      box-shadow: 0 4px 12px rgba(255, 77, 79, 0.1);
    }

    &:active {
      transform: scale(0.9);
      opacity: 0.8;
    }
  }
}

.empty-state {
  padding: 100px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #ccc;
  
  .empty-sub {
    font-size: 14px;
    color: #999;
  }
}

.log-group-card {
    background-color: #fff;
    border-radius: 20px;
    margin-bottom: 16px;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);
    
    .group-header {
      padding: 16px 20px 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;

      .date-info {
      display: flex;
      flex-direction: column;
      gap: 2px;

      .day {
        font-size: 24px;
        font-weight: 800;
        color: #1a1a1a;
        line-height: 1;
      }

      .date-bottom {
        display: flex;
        align-items: center;
        gap: 10px;

        .month-year {
          font-size: 12px;
          color: #999;
          font-weight: 500;
        }

        .daily-volume-tag {
          display: flex;
          align-items: center;
          gap: 4px;
          background-color: #f0f7ff;
          padding: 2px 8px;
          border-radius: 4px;

          .v-label {
            font-size: 11px;
            color: #007aff;
            font-weight: 500;
          }

          .v-value {
            font-size: 11px;
            font-weight: bold;
            color: #007aff;
          }
        }
      }
    }

      .edit-hint {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: #007aff;
        font-weight: 700;
        background-color: #f0f7ff;
        padding: 4px 10px;
        border-radius: 8px;
      }
    }

    .cat-groups {
      padding: 0 16px 16px;
    }

    .cat-sub-group {
      margin-top: 10px;
      .cat-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        font-weight: 800;
        margin-bottom: 8px;
        text-transform: uppercase;
        .dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
        }
      }
    }
    
    .action-items {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .action-item {
      display: block; // 改为块级布局，确保子项占满宽度
      padding: 10px 12px;
      background-color: #f8f9fb;
      border-radius: 12px;
      
      .action-main {
        width: 100%;
      }
      
      .action-name {
        font-size: 14px;
        font-weight: 700;
        color: #333;
      }

      .action-title-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 4px;
        width: 100%;
        
        .action-name {
          font-size: 14px;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 0;
          flex: 1;
          margin-right: 8px;
        }
        
        .action-set-tag {
          flex-shrink: 0;
          font-size: 10px;
          color: #007aff;
          background-color: #eef6ff;
          padding: 1px 6px;
          border-radius: 4px;
          font-weight: 600;
        }
      }
      
      .action-data-horizontal {
        display: flex;
        align-items: center;
        background-color: #fff;
        padding: 8px 12px;
        border-radius: 10px;
        margin-top: 2px;
        gap: 15px;

        .data-item {
          display: flex;
          align-items: center;
          gap: 4px;

          .label {
            font-size: 10px;
            color: #999;
            font-weight: 500;
          }

          .value {
            font-size: 14px;
            font-weight: 800;
            font-family: 'Monaco', monospace;
            
            &.weight { color: #007aff; }
            &.reps { color: #16a34a; }
          }

          .unit {
            font-size: 10px;
            color: #ccc;
            font-weight: 600;
          }
        }

        .data-divider {
          width: 1px;
          height: 12px;
          background-color: #f0f0f0;
        }
      }

      .action-data-vertical {
        display: flex;
        flex-direction: column;
        gap: 4px;
        background-color: #fff;
        padding: 8px 10px;
        border-radius: 10px;
        margin-top: 2px;

        .data-row {
          display: flex;
          align-items: center;
          gap: 6px;

          .row-label {
            font-size: 10px;
            color: #999;
            width: 28px;
            font-weight: 500;
          }

          .row-values {
            flex: 1;
            display: flex;
            gap: 4px;
            flex-wrap: wrap;

            .val-item {
              min-width: 24px;
              height: 18px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 11px;
              font-weight: 700;
              border-radius: 3px;
              font-family: 'Monaco', monospace;

              &.reps {
                background-color: #f0fdf4;
                color: #16a34a;
              }
              &.weight {
                background-color: #eef6ff;
                color: #007aff;
              }
            }
          }

          .row-unit {
            font-size: 10px;
            color: #ccc;
            font-weight: 600;
          }
        }
      }

      .cardio-note {
        font-size: 12px;
        color: #666;
        line-height: 1.3;
        background-color: #fff;
        padding: 6px 10px;
        border-radius: 6px;
        border-left: 3px solid #13c2c2;
      }
    }
  }

.custom-load-more {
  margin-top: 20px;
}

// 弹窗样式 (复用 index.vue)
.modern-log-popup {
  background-color: #fff;
  border-radius: 30px 30px 0 0;
  height: 85vh;
  display: flex;
  flex-direction: column;
  
  .popup-header {
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
        display: block;
      }
      .date-picker-wrap {
        display: flex;
        align-items: center;
        gap: 4px;
        .date-trigger {
          font-size: 13px;
          color: #007aff;
          font-weight: 700;
        }
        .subtitle {
          font-size: 13px;
          color: #999;
          font-weight: 600;
        }
      }
    }
    
    .close-btn {
      width: 36px;
      height: 36px;
      background-color: #f5f7fa;
      border-radius: 12px;
      display: flex;
      justify-content: center;
      align-items: center;
      margin-top: 15px;
    }
  }
  
  .popup-body {
    flex: 1;
    padding: 0 24px;
    box-sizing: border-box;
    overflow: hidden;
  }
  
  .log-card {
    background-color: #f8f9fb;
    border-radius: 20px;
    padding: 20px;
    margin-bottom: 16px;
    
    .log-card-header {
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      
      .name {
        font-size: 17px;
        font-weight: 700;
        color: #1a1a1a;
      }
    }
    
    .log-inputs {
      display: flex;
      flex-direction: column;
      gap: 12px;
      
      .input-main-row {
        display: flex;
        gap: 10px;
        align-items: flex-end;
      }

      .input-box {
        flex: 1;
        background-color: #fff;
        padding: 10px 12px;
        border-radius: 14px;
        
        .label {
          font-size: 10px;
          font-weight: 700;
          color: #999;
          text-transform: uppercase;
          display: block;
          margin-bottom: 4px;
        }
        
        input {
          font-size: 18px;
          font-weight: 700;
          color: #333;
          height: 24px;
        }
        
        &.weight {
          flex: 1.2;
          background-color: #eef6ff;
          input { color: #007aff; }
        }

        &.single-reps {
          background-color: #f0fdf4;
          input { color: #16a34a; }
        }
      }

      .multi-toggle {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 8px 10px;
        background-color: #fff;
        border-radius: 14px;
        min-width: 60px;
        height: 58px; // 匹配 input-box 高度
        box-sizing: border-box;
        border: 1px solid #f0f0f0;
        
        text {
          font-size: 10px;
          color: #999;
          font-weight: 700;
          margin-top: 4px;
          &.active { color: #007aff; }
        }
      }

      .multi-reps-container {
          background-color: #fff;
          padding: 16px;
          border-radius: 16px;
          
          .label {
            font-size: 12px;
            font-weight: 700;
            color: #666;
            margin-bottom: 12px;
            display: block;
          }

          .multi-reps-wrapper {
            display: flex;
            gap: 10px;
            align-items: flex-end;

            .side-labels {
              display: flex;
              flex-direction: column;
              gap: 4px;
              justify-content: flex-end;
              height: 64px;
              padding-bottom: 8px;
              margin-bottom: 5px;
              width: 32px; // 增加固定宽度防止换行
              flex-shrink: 0;

              .side-label {
                font-size: 11px;
                color: #999;
                height: 30px;
                line-height: 30px;
                font-weight: 600;
                white-space: nowrap; // 强制不换行
              }
            }

            .multi-reps-scroll {
              flex: 1;
              white-space: nowrap;
              width: 0; // 必须设置 width: 0 才能让 flex: 1 的 scroll-view 在容器内正常工作
            }
          }
          
          .multi-reps-grid {
            display: inline-flex;
            gap: 6px; // 缩小间距
            padding-bottom: 5px;
          }
          
          .multi-reps-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            flex-shrink: 0;
            width: 50px; // 缩小宽度至 58px，确保一屏能展示 4 组
            
            &.detail-mode {
              background-color: #f8f9fb;
              padding: 5px; // 缩小内边距
              border-radius: 10px;
              box-sizing: border-box;
            }
          
          .set-label {
            font-size: 10px;
            color: #999;
            font-weight: 600;
          }
          
          .detail-inputs {
            display: flex;
            flex-direction: column;
            gap: 4px;
            width: 100%;
          }
          
          .multi-input {
            width: 100%;
            height: 30px;
            background-color: #fff;
            border-radius: 6px;
            text-align: center;
            font-size: 12px;
            font-weight: 700;
            
            &.weight {
              color: #007aff;
              border: 1px solid #eef6ff;
            }
            &.reps {
              color: #16a34a;
              border: 1px solid #f0fdf4;
            }
          }
        }
      }
    }

    .cardio-input {
      background-color: #fff;
      padding: 16px;
      border-radius: 14px;
      textarea {
        width: 100%;
        min-height: 60px;
        font-size: 14px;
        color: #333;
        line-height: 1.6;
      }
    }
  }

  .popup-footer {
    padding: 20px 24px;
    padding-bottom: calc(20px + var(--window-bottom));
    background-color: #fff;
    border-top: 1px solid #f0f0f0;

    .quick-add-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;

      .quick-label {
        font-size: 12px;
        color: #999;
        font-weight: 600;
      }

      .quick-chip {
        display: flex;
        align-items: center;
        gap: 4px;
        background-color: #f0f7ff;
        color: #007aff;
        padding: 6px 12px;
        border-radius: 10px;
        font-size: 12px;
        font-weight: 700;
      }
    }
    
    .footer-btns {
      display: flex;
      gap: 12px;
    }
    
    .add-action-btn {
      flex: 1;
      height: 56px;
      background-color: #f0f7ff;
      color: #007aff;
      border-radius: 18px;
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 16px;
      font-weight: 700;
      gap: 6px;
      &::after { border: none; }
    }
    
    .submit-btn {
      flex: 1.5;
      height: 56px;
      background: linear-gradient(135deg, #007aff, #005bb7);
      color: #fff;
      border-radius: 18px;
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 16px;
      font-weight: 700;
      box-shadow: 0 8px 20px rgba(0, 122, 255, 0.2);
      &::after { border: none; }
    }
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
  }
}
</style>
