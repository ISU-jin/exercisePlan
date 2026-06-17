<template>
  <view class="training-container">
    <view class="status-bar"></view>
    
    <!-- 顶部信息栏 -->
    <view class="header-section">
      <view class="header-left">
        <button class="back-btn" @click="confirmExit">
          <uni-icons type="left" size="24" color="#333"></uni-icons>
        </button>
      </view>
      <view class="header-center">
        <view class="duration-wrap">
          <text class="duration-label">训练用时</text>
          <text class="duration">{{ durationText }}</text>
        </view>
      </view>
      <view class="header-right">
        <view class="start-info">
          <text class="label">开始时间</text>
          <text class="time">{{ formatTime(startTime) }}</text>
        </view>
      </view>
    </view>

    <!-- 当前动作卡片 -->
    <view class="main-content" v-if="currentAction">
      <view class="action-card">
        <view class="action-header">
          <view class="header-main">
            <view class="title-row">
              <text class="category-tag">{{ currentAction.category }}</text>
              <text class="action-name">{{ currentAction.name }}</text>
            </view>
            <view class="rest-settings">
              <text class="label">休息</text>
              <view class="rest-input-wrap">
                <input type="number" v-model="restTime" class="rest-input" />
                <text class="unit">s</text>
              </view>
            </view>
          </view>
          <view class="plan-info">
            计划: {{ currentAction.refReps }}次 x {{ currentAction.refSets }}组
          </view>
        </view>

        <view class="set-display">
          <view class="set-progress">
            第 <text class="current-set">{{ currentSetIndex }}</text> 组 / 共 {{ currentAction.sets.length }} 组
          </view>
          
          <view class="input-grid">
            <view class="input-item">
              <text class="label">重量 (KG)</text>
              <view class="number-input">
                <input :key="'w-' + currentActionIndex + '-' + currentSetIndex" type="digit" v-model="currentSet.weight" :cursor-spacing="20" />
              </view>
            </view>
            <view class="input-item">
              <text class="label">次数</text>
              <view class="number-input">
                <input :key="'r-' + currentActionIndex + '-' + currentSetIndex" type="number" v-model="currentSet.reps" :cursor-spacing="20" />
              </view>
            </view>
          </view>

          <button class="finish-set-btn" @click="finishSet">
            完成本组
          </button>
        </view>
      </view>

      <!-- 动作列表预览 -->
      <scroll-view 
        scroll-y 
        class="action-queue" 
        :scroll-into-view="'action-' + currentActionIndex"
        scroll-with-animation
      >
        <view 
          v-for="(action, index) in trainingActions" 
          :key="index" 
          :id="'action-' + index"
          class="queue-item"
          :class="{ active: index === currentActionIndex, completed: index < currentActionIndex }"
        >
          <view class="item-status">
            <uni-icons :type="index < currentActionIndex ? 'checkbox-filled' : (index === currentActionIndex ? 'right' : 'circle')" size="16" :color="index <= currentActionIndex ? '#007aff' : '#ddd'"></uni-icons>
          </view>
          <text class="item-name">{{ action.name }}</text>
          <text class="item-sets">{{ action.sets.length }}组</text>
        </view>
      </scroll-view>
    </view>

    <!-- 底部控制栏 -->
    <view class="footer-section">
      <view class="progress-bar-wrap">
        <view class="progress-text">总体进度 {{ Math.round(overallProgress * 100) }}%</view>
        <view class="progress-bg">
          <view class="progress-fill" :style="{ width: overallProgress * 100 + '%' }"></view>
        </view>
      </view>
      
      <view class="action-btns">
        <button class="sub-btn" @click="addSet">
          <text>加练一组</text>
          <uni-icons type="plus" size="16" color="#007aff"></uni-icons>

        </button>
        <button class="sub-btn" @click="skipAction" @touchstart="recordTouch">
          <text>跳过动作</text>
          <uni-icons type="forward" size="16" color="#666"></uni-icons>

        </button>
        <button class="end-btn" @click="endTraining">
          结束训练
        </button>
      </view>
    </view>

    <!-- 休息倒计时弹窗 -->
    <uni-popup ref="restPopup" type="center" :mask-click="false">
      <view class="rest-popup-card">
        <text class="title">休息中</text>
        
        <!-- 下一个动作提醒 -->
        <view class="next-action-tip" v-if="nextActionInfo">
          <text class="label">下一组</text>
          <view class="action-details">
            <text class="name">{{ nextActionInfo.name }}</text>
            <text class="set">第 {{ nextActionInfo.setIndex }} 组</text>
          </view>
        </view>
        
        <view class="countdown-container">
          <button class="adjust-btn minus" @click="adjustCountdown(-10)">-10s</button>
          
          <view class="countdown-circle-wrap">
            <view class="progress-circle" :style="{ background: `conic-gradient(#007aff ${restProgressPercent}%, #eef6ff 0)` }">
              <view class="inner-circle">
                <view class="time-display">
                  <text class="time">{{ countdown }}</text>
                  <text class="unit">s</text>
                </view>
              </view>
            </view>
          </view>

          <button class="adjust-btn plus" @click="adjustCountdown(10)">+10s</button>
        </view>

        <button class="skip-rest-btn" @click="skipRest">跳过休息</button>
      </view>
    </uni-popup>

    <!-- 训练总结弹窗 -->
    <uni-popup ref="summaryPopup" type="bottom" :mask-click="false" class="fullscreen-popup">
      <view class="summary-popup-card fullscreen">
        <view class="status-bar"></view>
        <view class="summary-header">
          <view class="success-icon">
            <uni-icons type="checkbox-filled" size="60" color="#007aff"></uni-icons>
          </view>
          <text class="title">训练已完成</text>
          <text class="subtitle">干得漂亮！今天的努力已被记录</text>
        </view>
        
        <view class="summary-stats">
          <view class="stat-item">
            <text class="value">{{ summaryData.duration }}</text>
            <text class="label">时长</text>
          </view>
          <view class="stat-item">
            <text class="value">{{ summaryData.actionCount }}</text>
            <text class="label">动作</text>
          </view>
          <view class="stat-item">
            <text class="value">{{ summaryData.totalSets }}</text>
            <text class="label">总组数</text>
          </view>
        </view>

        <scroll-view scroll-y class="summary-list">
          <view v-for="(item, index) in summaryData.logs" :key="index" class="summary-item">
            <view class="item-info">
              <text class="item-name">{{ item.name }}</text>
              <text class="item-detail">{{ item.sets }} 组 | 总量 {{ Math.round(calculateVolume(item)) }}kg</text>
            </view>
            <view class="item-data-vertical">
               <view class="data-row">
                 <text class="row-label">重量:</text>
                 <view class="row-values">
                   <text v-for="(w, wIdx) in (item.weight_detail || '').split(',').filter(v => v !== '')" :key="wIdx" class="val-item weight">{{ w }}</text>
                 </view>
                 <text class="row-unit">KG</text>
               </view>
               <view class="data-row">
                 <text class="row-label">次数:</text>
                 <view class="row-values">
                   <text v-for="(r, rIdx) in (item.reps_detail || '').split(',').filter(v => v !== '')" :key="rIdx" class="val-item reps">{{ r }}</text>
                 </view>
               </view>
             </view>
          </view>
        </scroll-view>

        <button class="confirm-finish-btn" @click="closeSummary">
          完成并返回
        </button>
      </view>
    </uni-popup>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { usePlanStore } from '@/stores/plan.js';
import { useExerciseStore } from '@/stores/exercise.js';
import { useLogStore } from '@/stores/log.js';
import { speak, stop } from '@/components/austin-tts/index.js';

const planStore = usePlanStore();
const exerciseStore = useExerciseStore();
const logStore = useLogStore();

const startTime = ref(new Date());
const duration = ref(0);
const timer = ref(null);
const currentActionIndex = ref(0);
const currentSetIndex = ref(1);
const restTime = ref(60);
const countdown = ref(0);
const countdownTimer = ref(null);
const restPopup = ref(null);
const summaryPopup = ref(null);
const summaryData = ref({
  duration: '',
  actionCount: 0,
  totalSets: 0,
  logs: []
});

const trainingActions = ref([]);

// 音频相关
const endAudio = uni.createInnerAudioContext();
endAudio.src = '/static/end_join.mp3';

// 格式化时间 HH:mm
const formatTime = (date) => {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
};

const formatLogDetail = (log) => {
  const repsArray = (log.reps_detail || '').split(',').filter(v => v !== '').map(Number);
  const weightArray = (log.weight_detail || '').split(',').filter(v => v !== '').map(Number);
  const sets = log.sets || 0;
  
  let details = [];
  if (repsArray.length > 0) {
    repsArray.forEach((r, i) => {
      const w = weightArray[i] !== undefined ? weightArray[i] : (weightArray[0] !== undefined ? weightArray[0] : (log.weight || 0));
      details.push(`${w}x${r}`);
    });
  } else {
    for (let i = 0; i < sets; i++) {
      details.push(`${log.weight}x${log.reps}`);
    }
  }
  return details.join(', ');
};

const calculateVolume = (log) => {
  const repsArray = (log.reps_detail || '').split(',').filter(v => v !== '').map(Number);
  const weightArray = (log.weight_detail || '').split(',').filter(v => v !== '').map(Number);
  
  if (repsArray.length > 0) {
    return repsArray.reduce((acc, r, i) => {
      const w = weightArray[i] !== undefined ? weightArray[i] : (weightArray[0] !== undefined ? weightArray[0] : (log.weight || 0));
      return acc + (r * w);
    }, 0);
  }
  return (log.sets || 0) * (log.reps || 0) * (log.weight || 0);
};

// 训练时长文本
const durationText = computed(() => {
  const m = Math.floor(duration.value / 60);
  const s = duration.value % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
});

// 当前动作
const currentAction = computed(() => trainingActions.value[currentActionIndex.value]);

// 当前组
const currentSet = computed(() => {
  if (!currentAction.value) return null;
  return currentAction.value.sets[currentSetIndex.value - 1];
});

// 总体进度
const overallProgress = computed(() => {
  if (trainingActions.value.length === 0) return 0;
  const totalSets = trainingActions.value.reduce((acc, a) => acc + a.sets.length, 0);
  let completedSets = 0;
  for (let i = 0; i < currentActionIndex.value; i++) {
    completedSets += trainingActions.value[i].sets.length;
  }
  completedSets += currentSetIndex.value - 1;
  return completedSets / totalSets;
});

const restProgressPercent = computed(() => {
  if (restTime.value <= 0) return 0;
  return (countdown.value / restTime.value) * 100;
});

// 计算下一个动作/组的信息
const nextActionInfo = computed(() => {
  if (!currentAction.value) return null;
  
  // 如果当前动作还有下一组
  if (currentSetIndex.value < currentAction.value.sets.length) {
    return {
      name: currentAction.value.name,
      setIndex: currentSetIndex.value + 1
    };
  }
  
  // 如果有下一个动作
  if (currentActionIndex.value < trainingActions.value.length - 1) {
    const nextAct = trainingActions.value[currentActionIndex.value + 1];
    return {
      name: nextAct.name,
      setIndex: 1
    };
  }
  
  return null;
});

onMounted(async () => {
  await initTraining();
  startTimer();
});

onUnmounted(() => {
  stopTimer();
  stopCountdown();
  stop(); // 停止语音播报
  endAudio.destroy();
});

const initTraining = async () => {
  const todayStr = new Date().toISOString().split('T')[0];
  const todayPlan = planStore.getPlanForDate(todayStr);
  
  if (!todayPlan || todayPlan.isRest || !todayPlan.action_ids.length) {
    uni.showToast({ title: '今日没有训练计划', icon: 'none' });
    setTimeout(() => uni.navigateBack(), 1500);
    return;
  }

  const actions = [];
  for (const id of todayPlan.action_ids) {
    const exercise = exerciseStore.actions.find(e => e.id === id);
    const category = exercise ? exercise.category : (id === -1 ? '有氧' : (id === -2 ? '核心' : '未知'));
    
    // 过滤有氧和核心动作，这些动作在主页手动打卡
    if (category === '有氧' || category === '核心') {
      continue;
    }

    const lastWeight = await logStore.fetchLastWeight(id);
    const settings = todayPlan.settings[id] || { sets: 4, reps: 12 };
    
    actions.push({
      id,
      name: exercise ? exercise.name : '未知动作',
      category: category,
      refSets: settings.sets,
      refReps: settings.reps,
      sets: Array.from({ length: settings.sets }, () => ({
        weight: lastWeight || 0,
        reps: settings.reps,
        completed: false
      }))
    });
  }

  if (actions.length === 0) {
    uni.showToast({ title: '今日仅有有氧/核心动作，请在主页直接打卡', icon: 'none', duration: 2000 });
    setTimeout(() => uni.navigateBack(), 2000);
    return;
  }

  trainingActions.value = actions;
};

const startTimer = () => {
  timer.value = setInterval(() => {
    duration.value++;
  }, 1000);
};

const stopTimer = () => {
  if (timer.value) clearInterval(timer.value);
};

const startCountdown = () => {
  countdown.value = restTime.value;
  restPopup.value.open();
  
  // 语音播报下一组信息
  if (nextActionInfo.value) {
    const text = `下一个动作是：${nextActionInfo.value.name}，第${nextActionInfo.value.setIndex}组`;
    speak(text, { 
      mode: 'native',
      rate: 1.1 // 稍微加快一点语速，听起来更干练
    });
  }

  countdownTimer.value = setInterval(() => {
    if (countdown.value > 0) {
      countdown.value--;
      // 在剩余3秒时触发音频 (倒计时到4秒时开始播放，因为 end_join.mp3 包含了倒数声)
      if (countdown.value === 4) {
        playEndSequence();
      }
    } else {
      skipRest();
    }
  }, 1000);
};

const playEndSequence = () => {
  endAudio.stop();
  endAudio.seek(0);
  endAudio.play();
};

const stopCountdown = () => {
  if (countdownTimer.value) clearInterval(countdownTimer.value);
};

const adjustCountdown = (val) => {
  countdown.value = Math.max(0, Number(countdown.value) + val);
};

const skipRest = () => {
  if (isSkippingRest) return;
  isSkippingRest = true;
  stopCountdown();
  stop(); // 如果还在播报，跳过休息时停止它
  restPopup.value.close();
  nextSet();
  setTimeout(() => { isSkippingRest = false; }, 500);
};

let isSkippingRest = false;

const finishSet = () => {
  const currentS = currentSet.value;
  currentS.completed = true;
  
  // 更新下一组的默认重量和次数为当前组的值
  if (currentSetIndex.value < currentAction.value.sets.length) {
    const nextS = currentAction.value.sets[currentSetIndex.value];
    nextS.weight = currentS.weight;
    nextS.reps = currentS.reps;
  }
  
  // 检查是否是最后一个动作的最后一组
  const isLastAction = currentActionIndex.value === trainingActions.value.length - 1;
  const isLastSet = currentSetIndex.value === currentAction.value.sets.length;
  
  if (isLastAction && isLastSet) {
    endTraining();
  } else {
    startCountdown();
  }
};

const nextSet = () => {
  if (currentSetIndex.value < currentAction.value.sets.length) {
    currentSetIndex.value++;
  } else {
    nextAction();
  }
};

const nextAction = () => {
  if (currentActionIndex.value < trainingActions.value.length - 1) {
    currentActionIndex.value++;
    currentSetIndex.value = 1;
  } else {
    endTraining();
  }
};

const addSet = () => {
  if (!currentAction.value) return;
  const lastSet = currentAction.value.sets[currentAction.value.sets.length - 1];
  currentAction.value.sets.push({
    weight: lastSet.weight,
    reps: lastSet.reps,
    completed: false
  });
};

let lastTouchTime = 0;

const recordTouch = () => {
  lastTouchTime = Date.now();
}

const skipAction = () => {

  if (Date.now() - lastTouchTime > 500) {
    return;
  }
  
  if (isProcessingAction) return;
  isProcessingAction = true;
  
  uni.showModal({
    title: '跳过动作',
    content: '确定要跳过当前动作吗？',
    success: (res) => {
      if (res.confirm) {
        nextAction();
      }
    },
    complete: () => {
      setTimeout(() => { isProcessingAction = false; }, 500);
    }
  });
};

let isProcessingAction = false;

const endTraining = () => {
  uni.showModal({
    title: '结束训练',
    content: '确定要结束本次训练并保存记录吗？',
    success: async (res) => {
      if (res.confirm) {
        await saveResults();
      }
    }
  });
};

const confirmExit = () => {
  uni.showModal({
    title: '退出训练',
    content: '当前训练尚未结束，确定退出吗？(不会保存进度)',
    confirmColor: '#ff4d4f',
    success: (res) => {
      if (res.confirm) {
        uni.navigateBack();
      }
    }
  });
};

const saveResults = async () => {
  const todayStr = new Date().toISOString().split('T')[0];
  const logs = [];
  let totalSets = 0;
  
  trainingActions.value.forEach(action => {
    const completedSets = action.sets.filter(s => s.completed);
    if (completedSets.length > 0) {
      const repsDetail = completedSets.map(s => s.reps);
      const weightDetail = completedSets.map(s => s.weight);
      const avgWeight = completedSets.reduce((acc, s) => acc + Number(s.weight), 0) / completedSets.length;
      
      totalSets += completedSets.length;
      
      logs.push({
        id: action.id,
        name: action.name,
        category: action.category,
        sets: completedSets.length,
        reps: Math.round(repsDetail.reduce((a, b) => a + Number(b), 0) / completedSets.length),
        weight: avgWeight.toFixed(1),
        reps_detail: repsDetail.join(','),
        weight_detail: weightDetail.join(','),
        note: ''
      });
    }
  });

  if (logs.length === 0) {
    uni.navigateBack();
    return;
  }

  try {
    uni.showLoading({ title: '保存中...' });
    await logStore.saveWorkout(todayStr, logs);
    uni.hideLoading();
    
    // 停止计时并准备总结数据
    stopTimer();
    summaryData.value = {
      duration: durationText.value,
      actionCount: logs.length,
      totalSets: totalSets,
      logs: logs
    };
    
    // 显示总结弹窗
    summaryPopup.value.open();
  } catch (e) {
    uni.hideLoading();
    uni.showToast({ title: '保存失败', icon: 'none' });
  }
};

const closeSummary = () => {
  summaryPopup.value.close();
  uni.navigateBack();
};
</script>

<style lang="scss">
.training-container {
  min-height: 100vh;
  background-color: #f8f9fb;
  display: flex;
  flex-direction: column;

  .status-bar {
    height: var(--status-bar-height);
  }

  .header-section {
    padding: 10px 20px;
    display: flex;
    align-items: center;
    background-color: #fff;
    border-bottom: 1px solid #f0f2f5;

    .header-left {
      flex: 1;
      .back-btn {
        width: 40px;
        height: 40px;
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        padding: 0;
        margin: 0;
        &::after { border: none; }
      }
    }

    .header-center {
      flex: 2;
      display: flex;
      justify-content: center;
      .duration-wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        .duration-label {
          font-size: 10px;
          color: #999;
          margin-bottom: 2px;
        }
        .duration {
          font-size: 28px;
          font-weight: 800;
          color: #007aff;
          font-family: 'Monaco', monospace;
          line-height: 1;
        }
      }
    }

    .header-right {
      flex: 1;
      display: flex;
      justify-content: flex-end;
      .start-info {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        .label {
          font-size: 10px;
          color: #999;
          margin-bottom: 2px;
        }
        .time {
          font-size: 14px;
          font-weight: 600;
          color: #333;
        }
      }
    }
  }

  .main-content {
    flex: 1;
    padding: 15px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 15px;
    padding-bottom: calc(150px + env(safe-area-inset-bottom)); // 增加底部边距以防遮挡

    .action-card {
      flex-shrink: 0; // 防止卡片被压缩
      background-color: #fff;
      border-radius: 20px;
      padding: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.03);

      .action-header {
        .header-main {
          display: flex;
          justify-content: space-between;
          align-items: center;
          
          .title-row {
            display: flex;
            align-items: center;
            gap: 8px;
            .category-tag {
              font-size: 10px;
              padding: 2px 6px;
              background-color: #eef6ff;
              color: #007aff;
              border-radius: 4px;
              font-weight: 600;
            }
            .action-name {
              font-size: 18px;
              font-weight: 700;
              color: #1a1a1a;
            }
          }

          .rest-settings {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            background-color: #f5f7fa;
            border-radius: 8px;
            .label {
              font-size: 11px;
              color: #999;
            }
            .rest-input-wrap {
              display: flex;
              align-items: center;
              gap: 2px;
              .rest-input {
                width: 30px;
                text-align: center;
                font-weight: 700;
                color: #007aff;
                font-size: 14px;
              }
              .unit {
                font-size: 10px;
                color: #999;
              }
            }
          }
        }

        .plan-info {
          font-size: 13px;
          color: #666;
          margin-top: 6px;
        }
      }

      .set-display {
        margin-top: 25px;
        text-align: center;

        .set-progress {
          font-size: 14px;
          color: #666;
          .current-set {
            font-size: 24px;
            font-weight: 800;
            color: #007aff;
            margin: 0 4px;
          }
        }

        .input-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-top: 20px;

          .input-item {
            .label {
              font-size: 12px;
              color: #999;
              display: block;
              margin-bottom: 8px;
            }
            .number-input {
              background-color: #f5f7fa;
              height: 50px;
              border-radius: 12px;
              display: flex;
              align-items: center;
              justify-content: center;
              transition: all 0.3s;

              &.disabled {
                background-color: #eee;
                opacity: 0.6;
              }

              input {
                font-size: 20px;
                font-weight: 700;
                color: #1a1a1a;
                width: 100%;
                text-align: center;
              }
            }
          }
        }

        .finish-set-btn {
          margin-top: 30px;
          height: 54px;
          background: linear-gradient(135deg, #007aff, #005bb7);
          color: #fff;
          border-radius: 27px;
          font-weight: 700;
          font-size: 16px;
          box-shadow: 0 4px 15px rgba(0, 122, 255, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          &::after { border: none; }
          &:active { opacity: 0.9; transform: scale(0.98); }
        }
      }
    }

    .action-queue {
      height: 220px; // 固定高度显示约4行
      background-color: #fff;
      border-radius: 16px;
      padding: 10px;
      box-sizing: border-box;
      flex-shrink: 0; // 防止被压缩
      
      .queue-item {
        display: flex;
        align-items: center;
        padding: 12px 15px;
        background-color: #fcfcfc;
        border-radius: 12px;
        margin-bottom: 10px;
        opacity: 0.6;
        transition: all 0.3s;
        
        &.active {
          opacity: 1;
          background-color: #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          border-left: 4px solid #007aff;
        }
        
        &.completed {
          opacity: 0.4;
          .item-name {
            text-decoration: line-through;
          }
        }

        .item-status {
          margin-right: 12px;
        }
        .item-name {
          flex: 1;
          font-size: 14px;
          color: #333;
          font-weight: 600;
        }
        .item-sets {
          font-size: 12px;
          color: #999;
        }
      }
    }
  }

  .footer-section {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 100;
    background-color: #fff;
    padding: 15px 20px calc(15px + env(safe-area-inset-bottom));
    box-shadow: 0 -4px 12px rgba(0,0,0,0.05);

    .progress-bar-wrap {
      margin-bottom: 15px;
      .progress-text {
        font-size: 11px;
        color: #999;
        margin-bottom: 6px;
      }
      .progress-bg {
        height: 6px;
        background-color: #f0f2f5;
        border-radius: 3px;
        overflow: hidden;
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #007aff, #00c6ff);
          border-radius: 3px;
          transition: width 0.3s;
        }
      }
    }

    .action-btns {
      display: flex;
      gap: 12px;
      
      .sub-btn {
        flex: 1;
        height: 44px;
        background-color: #f5f7fa;
        color: #666;
        font-size: 13px;
        font-weight: 600;
        border-radius: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        margin: 0;
        padding: 0;
        &::after { border: none; }
      }

      .end-btn {
        flex: 1.2;
        height: 44px;
        background-color: #ff4d4f;
        color: #fff;
        font-size: 14px;
        font-weight: 700;
        border-radius: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0;
        padding: 0;
        box-shadow: 0 4px 12px rgba(255, 77, 79, 0.2);
        &::after { border: none; }
      }
    }
  }
}

.rest-popup-card {
    background-color: #fff;
    width: 320px;
    padding: 30px 20px;
    border-radius: 30px;
    display: flex;
    flex-direction: column;
    align-items: center;

    .title {
      font-size: 20px;
      font-weight: 700;
      color: #333;
      margin-bottom: 20px;
    }

    .next-action-tip {
      background-color: #f0f7ff;
      padding: 12px 20px;
      border-radius: 16px;
      width: 100%;
      box-sizing: border-box;
      margin-bottom: 25px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;

      .label {
        font-size: 11px;
        color: #007aff;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .action-details {
        display: flex;
        align-items: center;
        gap: 8px;
        .name {
          font-size: 16px;
          font-weight: 700;
          color: #333;
        }
        .set {
          font-size: 13px;
          color: #666;
          background-color: #fff;
          padding: 2px 8px;
          border-radius: 6px;
        }
      }
    }

    .countdown-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 15px;
      margin-bottom: 40px;
      width: 100%;

      .adjust-btn {
        width: 60px;
        height: 60px;
        border-radius: 30px;
        background-color: #f5f7fa;
        color: #333;
        font-size: 14px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        margin: 0;
        &::after { border: none; }
        &:active { background-color: #e4e7ed; transform: scale(0.95); }
        
        &.minus { color: #ff4d4f; }
        &.plus { color: #4cd964; }
      }

      .countdown-circle-wrap {
        position: relative;
        width: 160px;
        height: 160px;
        display: flex;
        align-items: center;
        justify-content: center;

        .progress-circle {
          width: 160px;
          height: 160px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.3s;
          // conic-gradient will be applied via :style
        }

        .inner-circle {
          width: 144px; // 160 - 8*2
          height: 144px;
          background-color: #fff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .time-display {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;

          .time {
            font-size: 48px;
            font-weight: 800;
            color: #007aff;
            line-height: 1;
            font-family: 'Monaco', monospace;
          }
          .unit {
            font-size: 14px;
            color: #999;
            margin-top: 4px;
          }
        }
      }
    }

    .skip-rest-btn {
      width: 100%;
      height: 54px;
      line-height: 54px;
      background: linear-gradient(135deg, #007aff, #005bb7);
      color: #fff;
      border-radius: 27px;
      font-size: 18px;
      font-weight: 700;
      box-shadow: 0 4px 12px rgba(0, 122, 255, 0.2);
      &::after { border: none; }
      &:active { opacity: 0.9; transform: scale(0.98); }
    }
  }

  .fullscreen-popup {
    z-index: 9999 !important;
  }

  .summary-popup-card {
    background-color: #fff;
    border-radius: 30px 30px 0 0;
    padding: 30px 20px env(safe-area-inset-bottom);
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;

    &.fullscreen {
      width: 100vw;
      height: 100vh;
      max-height: 100vh;
      border-radius: 0;
      padding-top: 0;
      margin: 0;
      
      .status-bar {
        height: var(--status-bar-height);
        flex-shrink: 0;
      }
    }

    .summary-header {
      text-align: center;
      margin-bottom: 30px;
      padding-top: 20px;
      width: 100%;
      box-sizing: border-box;

      .success-icon {
        margin-bottom: 15px;
      }

      .title {
        font-size: 26px;
        font-weight: 800;
        color: #1a1a1a;
        display: block;
      }
      .subtitle {
        font-size: 15px;
        color: #999;
        margin-top: 10px;
        display: block;
      }
    }

    .summary-stats {
      display: flex;
      justify-content: space-around;
      background-color: #f8f9fb;
      padding: 20px;
      border-radius: 20px;
      margin-bottom: 25px;
      width: 100%;
      box-sizing: border-box;

      .stat-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        .value {
          font-size: 20px;
          font-weight: 700;
          color: #007aff;
        }
        .label {
          font-size: 12px;
          color: #999;
          margin-top: 4px;
        }
      }
    }

    .summary-list {
      flex: 1;
      width: 100%;
      overflow-y: auto;
      margin-bottom: 20px;
      box-sizing: border-box;

      .summary-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 0;
        border-bottom: 1px solid #f5f5f5;
        width: 100%;
        box-sizing: border-box;

        &:last-child { border-bottom: none; }
        
        .item-info {
          flex: 1;
          margin-right: 10px;
          min-width: 0; // 允许 flex 子项缩小

          .item-name {
            font-size: 16px;
            font-weight: 600;
            color: #333;
            display: block;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .item-detail {
            font-size: 12px;
            color: #999;
            margin-top: 4px;
            display: block;
          }
        }
        .item-data-vertical {
            display: flex;
            flex-direction: column;
            gap: 4px;
            max-width: 65%;

            .data-row {
              display: flex;
              align-items: center;
              gap: 6px;
              justify-content: flex-end;

              .row-label {
                font-size: 10px;
                color: #999;
              }

              .row-values {
                display: flex;
                gap: 4px;
                flex-wrap: wrap;
                justify-content: flex-end;

                .val-item {
                  min-width: 24px;
                  height: 18px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 11px;
                  font-weight: 700;
                  border-radius: 4px;
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
                font-size: 9px;
                color: #ccc;
                font-weight: 600;
              }
            }
          }
      }
    }

    .confirm-finish-btn {
      width: 100%;
      height: 54px;
      line-height: 54px;
      background-color: #007aff;
      color: #fff;
      border-radius: 27px;
      font-size: 18px;
      font-weight: 700;
      margin-top: 10px;
      margin-bottom: 20px;
      box-sizing: border-box;
      &::after { border: none; }
    }
  }
</style>