<template>
  <view class="container">
    <view class="status-bar"></view>
    
    <view class="header-section">
      <view class="header-left">
        <text class="date-text">{{ todayFormatted }}</text>
        <text class="greeting-text">{{ greeting }}</text>
      </view>
      <view class="header-right">
        <view class="avatar" @click="showProfilePopup">
          <uni-icons type="person-filled" size="24" color="#fff"></uni-icons>
        </view>
      </view>
    </view>

    <view class="main-content">
      <view v-if="!planStore.activePlan" class="empty-plan-card" @click="goToPlan">
        <view class="card-icon">
          <uni-icons type="compose" size="40" color="#007aff"></uni-icons>
        </view>
        <text class="card-title">开启您的健身计划</text>
        <text class="card-desc">尚未设置训练计划，点击立即前往设置</text>
        <button class="setup-btn">去设置</button>
      </view>

      <view v-else-if="todayPlan" class="today-card">
        <view class="card-header">
          <view class="tag-row">
            <view class="plan-tag">当前计划: {{ planStore.activePlan.split_type === 3 ? '三分化' : '五分化' }}</view>
          </view>
          
          <view v-if="todayPlan.isRest" class="rest-title-row">
            <text class="title">今日休息</text>
            <text class="subtitle">{{ todayPlan.reason }}</text>
          </view>
          <view v-else class="workout-title-row">
            <text class="group-name">{{ todayPlan.target_group }}</text>
            <text class="group-label">今日训练部位</text>
          </view>
        </view>

        <view v-if="todayPlan.isRest" class="rest-body">
          <view class="rest-illustration">
            <uni-icons type="refresh-filled" size="80" color="#e1f0ff"></uni-icons>
          </view>
          <text class="rest-quote">休息也是训练的一部分</text>
        </view>
        <view v-else class="workout-body">
          <scroll-view scroll-y="true" class="action-list-scroll">
            <view class="action-list">
              <view v-for="actionId in todayPlan.action_ids" :key="actionId" class="action-item">
                <view class="action-info">
                  <view class="name-row">
                    <text class="group-tag">{{ getActionCategory(actionId) }}</text>
                    <text class="name">{{ getActionName(actionId) }}</text>
                  </view>
                  <text class="target" v-if="getActionCategory(actionId) !== '有氧'">{{ todayPlan.settings[actionId].sets }} 组 x {{ todayPlan.settings[actionId].reps }} 次</text>
                  <text class="target" v-else>有氧运动：记录时输入内容</text>
                </view>
                <uni-icons type="checkbox-filled" size="24" color="#eee"></uni-icons>
              </view>
            </view>
          </scroll-view>
        </view>

        <view class="card-footer">
          <button v-if="!todayPlan.isRest" class="action-btn rest" @click="confirmRest">
            <uni-icons type="info" size="18" color="#666"></uni-icons>
            <text>休</text>
          </button>
          <button v-if="!todayPlan.isRest" class="action-btn start" @click="showLogPopup">
            <text>开始训练打卡</text>
            <uni-icons type="arrow-right" size="18" color="#fff"></uni-icons>
          </button>
          <button v-else class="action-btn full" @click="goToCalendar">
            <text>查看训练日历</text>
          </button>
        </view>
      </view>
    </view>

    <!-- 打卡弹窗 -->
    <uni-popup ref="logPopup" type="bottom">
      <view class="modern-log-popup">
        <view class="popup-header">
          <view class="drag-handle"></view>
          <view class="header-content">
            <text class="title">训练记录</text>
            <view class="date-picker-wrap">
              <uni-datetime-picker type="date" v-model="logDate" :border="false" :clear-icon="false">
                <text class="date-trigger">{{ logDate === todayStr ? '今日' : logDate }}</text>
              </uni-datetime-picker>
              <text class="subtitle">· {{ logActions.length }} 个动作</text>
            </view>
          </view>
          <view class="close-btn" @click="logPopup.close()">
            <uni-icons type="closeempty" size="20" color="#999"></uni-icons>
          </view>
        </view>
        
        <scroll-view scroll-y="true" class="popup-body">
          <view v-for="(action, index) in logActions" :key="index" class="log-card">
            <view class="log-card-header">
              <view class="header-left">
                <text class="name">{{ action.name }}</text>
                <text v-if="action.isPreset && action.category !== '有氧'" class="ref">建议: {{ action.refSets }}组 x {{ action.refReps }}次</text>
              </view>
              <view class="header-right" @click="removeLogAction(index)">
                <uni-icons type="trash" size="20" color="#ff4d4f"></uni-icons>
              </view>
            </view>
            
            <!-- 有氧特殊 UI -->
            <view v-if="action.category === '有氧'" class="cardio-input">
              <textarea 
                v-model="action.note" 
                placeholder="在此输入有氧内容（如：跑步 30分钟 5KM）" 
                auto-height
              ></textarea>
            </view>
            
            <!-- 力量训练 UI -->
            <view v-else class="log-inputs">
              <view class="input-box">
                <text class="label">实际组数</text>
                <input type="number" v-model="action.sets" />
              </view>
              <view class="input-box">
                <text class="label">实际次数</text>
                <input type="number" v-model="action.reps" />
              </view>
              <view class="input-box weight">
                <text class="label">重量 (KG)</text>
                <input type="digit" v-model="action.weight" />
              </view>
            </view>
          </view>
        </scroll-view>
        
        <view class="popup-footer">
          <view class="footer-btns">
            <button class="add-action-btn" @click="showActionPicker">
              <uni-icons type="plus" size="20" color="#007aff"></uni-icons>
              <text>添加动作</text>
            </button>
            <button class="submit-btn" @click="submitLog">保存训练记录</button>
          </view>
        </view>
      </view>
    </uni-popup>

    <!-- 动作选择弹窗 (用于打卡时新增) -->
    <uni-popup ref="actionPopup" type="bottom">
      <view class="modern-picker">
        <view class="picker-header">
          <view class="drag-handle"></view>
          <view class="header-content">
            <text class="title">选择动作</text>
            <text class="subtitle">打卡时临时增加动作</text>
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

    <!-- 个人中心/数据管理弹窗 -->
    <uni-popup ref="profilePopup" type="bottom">
      <view class="profile-drawer">
        <view class="drawer-header">
          <view class="drag-handle"></view>
          <view class="user-info">
            <view class="large-avatar">
              <uni-icons type="person-filled" size="40" color="#fff"></uni-icons>
            </view>
            <view class="info-content">
              <text class="user-name">健身达人</text>
              <text class="user-sub">记录进步，成就更好的自己</text>
            </view>
          </view>
        </view>
        
        <view class="drawer-body">
          <view class="menu-section">
            <text class="section-title">数据管理</text>
            <view class="menu-grid">
              <view class="menu-item" @click="exportData">
                <view class="icon-wrap export">
                  <uni-icons type="download-filled" size="24" color="#007aff"></uni-icons>
                </view>
                <text class="menu-label">导出备份</text>
                <text class="menu-sub">导出全部数据</text>
              </view>
              <view class="menu-item" @click="importData">
                <view class="icon-wrap import">
                  <uni-icons type="upload-filled" size="24" color="#ff9500"></uni-icons>
                </view>
                <text class="menu-label">导入数据</text>
                <text class="menu-sub">还原备份记录</text>
              </view>
            </view>
          </view>
          
          <view class="app-info">
            <text>运动计划管理 v1.0.0</text>
          </view>
        </view>
      </view>
    </uni-popup>
  </view>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { usePlanStore } from '@/stores/plan.js';
import { useExerciseStore } from '@/stores/exercise.js';
import { useLogStore } from '@/stores/log.js';
import { db } from '@/utils/db.js';

const planStore = usePlanStore();
const exerciseStore = useExerciseStore();
const logStore = useLogStore();

const todayStr = new Date().toISOString().split('T')[0];
const todayPlan = ref(null);
const logPopup = ref(null);
const actionPopup = ref(null);
const profilePopup = ref(null);
const logActions = ref([]);
const logDate = ref(todayStr);

// 动作选择相关
const pickerCategories = ['全部', '胸', '背', '腿', '肩', '手臂', '腹部', '有氧'];
const pickerCurrentCat = ref('全部');

const filteredPickerActions = computed(() => {
  let list = exerciseStore.actions;
  if (pickerCurrentCat.value !== '全部') {
    list = list.filter(a => a.category.startsWith(pickerCurrentCat.value));
  }
  // 确保有氧选项始终存在，即使库里没加动作
  if (pickerCurrentCat.value === '有氧' && list.length === 0) {
    return [{ id: -1, name: '自定义有氧', category: '有氧' }];
  }
  return list;
});

const todayFormatted = computed(() => {
  const d = new Date();
  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const weeks = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return `${months[d.getMonth()]}${d.getDate()}日 ${weeks[d.getDay()]}`;
});

const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 9) return '早安，开启活力一天';
  if (hour < 12) return '上午好，保持专注';
  if (hour < 18) return '下午好，来场训练吧';
  return '晚上好，今天的目标达成了吗';
});

const getActionName = (id) => {
  const action = exerciseStore.actions.find(a => a.id === id);
  return action ? action.name : '未知动作';
};

const getActionCategory = (id) => {
  const action = exerciseStore.actions.find(a => a.id === id);
  return action ? action.category : '';
};

const updateTodayPlan = () => {
  if (planStore.activePlan) {
    todayPlan.value = planStore.getPlanForDate(todayStr);
  } else {
    todayPlan.value = null;
  }
};

onMounted(async () => {
  await exerciseStore.fetchActions();
  await planStore.fetchActivePlan();
  updateTodayPlan();
});

watch(() => planStore.activePlan, updateTodayPlan);
watch(() => planStore.adjustments, updateTodayPlan, { deep: true });

const goToPlan = () => {
  uni.switchTab({ url: '/pages/plan/index' });
};

const goToCalendar = () => {
  uni.switchTab({ url: '/pages/calendar/index' });
};

const confirmRest = () => {
  uni.showModal({
    title: '调整休息',
    content: '今日确定要临时休息吗？之后的计划将自动向后顺延。',
    confirmColor: '#007aff',
    success: async (res) => {
      if (res.confirm) {
        await planStore.addAdjustment(todayStr);
        uni.showToast({ title: '已调整为休息' });
      }
    }
  });
};

const showLogPopup = async () => {
  if (!todayPlan.value) {
    logActions.value = [];
  } else {
    const actions = [];
    for (const id of todayPlan.value.action_ids) {
      const actionInfo = exerciseStore.actions.find(a => a.id === id);
      const lastWeight = await logStore.fetchLastWeight(id);
      actions.push({
        id,
        name: actionInfo?.name || '未知',
        category: actionInfo?.category || '',
        sets: todayPlan.value.settings[id].sets,
        reps: todayPlan.value.settings[id].reps,
        refSets: todayPlan.value.settings[id].sets,
        refReps: todayPlan.value.settings[id].reps,
        weight: lastWeight || 0,
        note: '',
        isPreset: true
      });
    }
    logActions.value = actions;
  }
  logDate.value = todayStr;
  logPopup.value.open();
};

const removeLogAction = (index) => {
  logActions.value.splice(index, 1);
};

const showActionPicker = () => {
  pickerCurrentCat.value = todayPlan.value?.target_group || '全部';
  actionPopup.value.open();
};

const addExtraAction = async (action) => {
  const lastWeight = action.id > 0 ? await logStore.fetchLastWeight(action.id) : 0;
  logActions.value.push({
    id: action.id > 0 ? action.id : 0,
    name: action.name,
    category: action.category,
    sets: 4,
    reps: 12,
    weight: lastWeight || 0,
    note: '',
    isPreset: false
  });
  actionPopup.value.close();
};

const submitLog = async () => {
  if (logActions.value.length === 0) {
    uni.showToast({ title: '请至少保留一个动作', icon: 'none' });
    return;
  }
  try {
    await logStore.saveWorkout(logDate.value, logActions.value);
    logPopup.value.close();
    uni.showToast({ title: '训练记录已保存' });
  } catch (e) {
    uni.showToast({ title: '保存失败', icon: 'none' });
  }
};

const showProfilePopup = () => {
  profilePopup.value.open();
};

const exportData = async () => {
  try {
    const jsonStr = await db.exportData();
    uni.setClipboardData({
      data: jsonStr,
      success: () => {
        uni.showModal({
          title: '导出成功',
          content: '数据已复制到剪贴板，请妥善保存。',
          showCancel: false
        });
      }
    });
  } catch (e) {
    uni.showToast({ title: '导出失败', icon: 'none' });
  }
};

const importData = () => {
  uni.showModal({
    title: '导入提示',
    content: '导入将覆盖现有所有数据，确定继续吗？',
    success: (res) => {
      if (res.confirm) {
        uni.getClipboardData({
          success: async (clip) => {
            try {
              if (!clip.data) throw new Error('剪贴板为空');
              await db.importData(clip.data);
              // 刷新所有 Store
              await exerciseStore.fetchActions();
              await planStore.fetchActivePlan();
              updateTodayPlan();
              profilePopup.value.close();
              uni.showToast({ title: '导入成功' });
            } catch (e) {
              uni.showToast({ title: '导入失败，请检查剪贴板内容', icon: 'none' });
            }
          }
        });
      }
    }
  });
};
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background-color: #f8f9fb;
  padding: 0 20px 40px;
}

.status-bar {
  height: var(--status-bar-height);
}

.header-section {
  padding: 15px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;

  .date-text {
    font-size: 14px;
    color: #999;
    font-weight: 500;
  }

  .greeting-text {
    font-size: 22px;
    font-weight: 800;
    color: #1a1a1a;
    display: block;
    margin-top: 4px;
  }

  .avatar {
    width: 44px;
    height: 44px;
    background: linear-gradient(135deg, #007aff, #005bb7);
    border-radius: 14px;
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: 0 4px 12px rgba(0, 122, 255, 0.2);
  }
}

.empty-plan-card {
  background-color: #fff;
  border-radius: 24px;
  padding: 40px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04);
  
  .card-icon {
    width: 80px;
    height: 80px;
    background-color: #f0f7ff;
    border-radius: 30px;
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 24px;
  }
  
  .card-title {
    font-size: 20px;
    font-weight: 700;
    color: #1a1a1a;
  }
  
  .card-desc {
    font-size: 14px;
    color: #999;
    margin-top: 12px;
    line-height: 1.6;
  }
  
  .setup-btn {
    margin-top: 32px;
    background: linear-gradient(135deg, #007aff, #005bb7);
    color: #fff;
    padding: 0 40px;
    height: 48px;
    line-height: 48px;
    border-radius: 16px;
    font-weight: 600;
    &::after { border: none; }
  }
}

.today-card {
  background-color: #fff;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.05);
  
  .card-header {
    padding: 24px;
    background: linear-gradient(to bottom, #f0f7ff, #fff);
    
    .plan-tag {
      font-size: 11px;
      font-weight: 700;
      color: #007aff;
      background-color: rgba(0, 122, 255, 0.1);
      padding: 4px 10px;
      border-radius: 6px;
      display: inline-block;
      margin-bottom: 16px;
    }
    
    .group-name {
      font-size: 36px;
      font-weight: 900;
      color: #1a1a1a;
      display: block;
    }
    
    .group-label {
      font-size: 13px;
      color: #999;
      font-weight: 600;
      margin-top: 4px;
      display: block;
    }

    .rest-title-row {
      .title {
        font-size: 36px;
        font-weight: 900;
        color: #1a1a1a;
        display: block;
      }
      .subtitle {
        font-size: 14px;
        color: #007aff;
        font-weight: 600;
        margin-top: 4px;
        display: block;
      }
    }
  }
  
  .workout-body {
    padding: 0 24px;
    
    .action-list-scroll {
      max-height: 270px; // 大约3个项目的高度
    }
    
    .action-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding-bottom: 24px;
    }
    
    .action-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      background-color: #f8f9fb;
      border-radius: 16px;
      
      .name-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
      }
      
      .group-tag {
        font-size: 10px;
        font-weight: 700;
        background-color: #eef6ff;
        color: #007aff;
        padding: 2px 6px;
        border-radius: 4px;
      }
      
      .name {
        font-size: 16px;
        font-weight: 700;
        color: #333;
      }
      
      .target {
        font-size: 13px;
        color: #999;
        display: block;
      }
    }
  }

  .rest-body {
    padding: 20px 24px 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    
    .rest-illustration {
      padding: 30px;
      background-color: #f0f7ff;
      border-radius: 40px;
      margin-bottom: 20px;
    }
    
    .rest-quote {
      font-size: 15px;
      color: #666;
      font-style: italic;
    }
  }
  
  .card-footer {
    padding: 20px 24px 24px;
    display: flex;
    gap: 12px;
    
    .action-btn {
      flex: 1;
      height: 54px;
      border-radius: 16px;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
      font-weight: 700;
      font-size: 15px;
      margin: 0;
      
      &::after { border: none; }
      
      &.rest {
        flex: 0.4;
        background-color: #f5f7fa;
        color: #666;
      }
      
      &.start {
        background: linear-gradient(135deg, #007aff, #005bb7);
        color: #fff;
        box-shadow: 0 4px 15px rgba(0, 122, 255, 0.3);
      }

      &.full {
        background-color: #f0f7ff;
        color: #007aff;
      }
    }
  }
}

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
      
      .ref {
        font-size: 12px;
        color: #007aff;
        font-weight: 600;
      }
    }
    
    .log-inputs {
      display: flex;
      gap: 12px;
      
      .input-box {
        flex: 1;
        background-color: #fff;
        padding: 12px;
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
          flex: 1.4;
          background-color: #eef6ff;
          input { color: #007aff; }
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
    padding: 24px;
    padding-bottom: calc(24px + var(--window-bottom));
    background-color: #fff;
    border-top: 1px solid #f0f0f0;
    
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
}

.profile-drawer {
  background-color: #f8f9fb;
  border-radius: 30px 30px 0 0;
  min-height: 40vh;
  padding-bottom: calc(30px + var(--window-bottom));
  
  .drawer-header {
    padding: 10px 24px 30px;
    background-color: #fff;
    border-radius: 30px 30px 0 0;
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
    
    .user-info {
      margin-top: 25px;
      display: flex;
      align-items: center;
      gap: 16px;
      
      .large-avatar {
        width: 64px;
        height: 64px;
        background: linear-gradient(135deg, #007aff, #005bb7);
        border-radius: 20px;
        display: flex;
        justify-content: center;
        align-items: center;
        box-shadow: 0 4px 12px rgba(0, 122, 255, 0.2);
      }
      
      .user-name {
        font-size: 20px;
        font-weight: 800;
        color: #1a1a1a;
        display: block;
      }
      
      .user-sub {
        font-size: 13px;
        color: #999;
        margin-top: 4px;
        display: block;
      }
    }
  }
  
  .drawer-body {
    padding: 24px;
    
    .menu-section {
      .section-title {
        font-size: 14px;
        font-weight: 700;
        color: #999;
        margin-bottom: 16px;
        display: block;
        padding-left: 4px;
      }
      
      .menu-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }
      
      .menu-item {
        background-color: #fff;
        padding: 20px;
        border-radius: 20px;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
        
        .icon-wrap {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          justify-content: center;
          align-items: center;
          margin-bottom: 12px;
          
          &.export { background-color: #eef6ff; }
          &.import { background-color: #fff7e6; }
        }
        
        .menu-label {
          font-size: 16px;
          font-weight: 700;
          color: #333;
        }
        
        .menu-sub {
          font-size: 11px;
          color: #999;
          margin-top: 4px;
        }
      }
    }
    
    .app-info {
      margin-top: 40px;
      text-align: center;
      font-size: 12px;
      color: #ccc;
    }
  }
}
</style>

