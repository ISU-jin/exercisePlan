<template>
  <view class="container">
    <view class="status-bar"></view>
    
    <view class="header-section">
      <view class="back-btn" @click="goBack">
        <uni-icons type="left" size="24" color="#333"></uni-icons>
      </view>
      <text class="title">组间休息计时</text>
      <view class="placeholder"></view>
    </view>

    <view class="timer-content">
      <!-- 增加大面积点击区域，点击整个显示区即可控制开始/停止 -->
      <view class="timer-display-wrapper" @click="toggleTimer">
        <view class="timer-display" :class="{ 'is-running': isRunning, 'is-finished': remainingTime === 0 && !isInitial }">
          <text class="time-text">{{ formatTime(remainingTime) }}</text>
          <text class="status-text">{{ isRunning ? '正在计时' : (remainingTime === 0 && !isInitial ? '时间到！' : '点击此处开始') }}</text>
        </view>
      </view>

      <view class="setup-section" v-if="!isRunning">
        <view class="input-group">
          <text class="label">设置休息时间 (秒)</text>
          <view class="number-selector">
            <view class="btn minus" @click.stop="adjustTime(-5)">-5</view>
            <input type="number" v-model.number="setTime" class="time-input" @click.stop="" />
            <view class="btn plus" @click.stop="adjustTime(5)">+5</view>
          </view>
        </view>
        
        <view class="quick-presets">
          <view 
            v-for="preset in presets" 
            :key="preset" 
            class="preset-chip"
            :class="{ active: setTime === preset }"
            @click.stop="setTime = preset"
          >{{ preset }}s</view>
        </view>
      </view>

      <view class="action-section">
        <button v-if="!isRunning" class="start-btn big-btn" @click="startTimer">开始计时</button>
        <button v-else class="stop-btn big-btn" @click="stopTimer">停止计时</button>
        <button v-if="!isRunning && !isInitial" class="reset-btn" @click="resetTimer">重置</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onUnmounted, watch } from 'vue';

const setTime = ref(60);
const remainingTime = ref(60);
const isRunning = ref(false);
const isInitial = ref(true);
const presets = [30, 45, 60, 90, 120];

let timer = null;
let audioContext = null;

// 监听设置时间的变化，在未开始计时时同步更新剩余时间
watch(setTime, (newVal) => {
  if (!isRunning.value) {
    remainingTime.value = Number(newVal) || 0;
  }
});

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const adjustTime = (val) => {
  const newVal = Number(setTime.value) + val;
  if (newVal >= 1) {
    setTime.value = newVal;
    remainingTime.value = newVal;
  }
};

const startTimer = () => {
  if (setTime.value <= 0) return;
  
  remainingTime.value = setTime.value;
  isRunning.value = true;
  isInitial.value = false;
  
  timer = setInterval(() => {
    if (remainingTime.value > 0) {
      remainingTime.value--;
    } else {
      playAlarm();
      finishTimer();
    }
  }, 1000);
};

const stopTimer = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  isRunning.value = false;
};

const resetTimer = () => {
  stopTimer();
  remainingTime.value = setTime.value;
  isInitial.value = true;
};

const toggleTimer = () => {
  if (isRunning.value) {
    stopTimer();
  } else {
    startTimer();
  }
};

const finishTimer = () => {
  stopTimer();
  
};

const playAlarm = () => {
  if (!audioContext) {
    audioContext = uni.createInnerAudioContext();
    audioContext.src = '/static/clock.mp3';
  }
  audioContext.play();
};

const goBack = () => {
  uni.navigateBack();
};

onUnmounted(() => {
  stopTimer();
  if (audioContext) {
    audioContext.destroy();
    audioContext = null;
  }
});
</script>

<style lang="scss" scoped>
.container {
  padding: 0 20px;
  min-height: 100vh;
  background-color: #f8f9fb;
}

.status-bar {
  height: var(--status-bar-height);
}

.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 0;
  
  .back-btn {
    width: 40px;
    height: 40px;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: #fff;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  }
  
  .title {
    font-size: 18px;
    font-weight: 700;
    color: #1a1a1a;
  }
  
  .placeholder {
    width: 40px;
  }
}

.timer-content {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.timer-display-wrapper {
  width: 100%;
  padding: 30px 0;
  display: flex;
  justify-content: center;
  align-items: center;
  
  &:active {
    opacity: 0.9;
    transform: scale(0.98);
  }
}

.timer-display {
  text-align: center;
  width: 260px;
  height: 260px;
  background-color: #fff;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  box-shadow: 0 10px 40px rgba(0,0,0,0.05);
  border: 10px solid #f0f7ff;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  
  &.is-running {
    border-color: #007aff;
    box-shadow: 0 0 30px rgba(0, 122, 255, 0.2);
    background-color: #f0f7ff;
    
    .time-text {
      color: #007aff;
      transform: scale(1.1);
    }
  }
  
  &.is-finished {
    border-color: #ff4d4f;
    animation: pulse 1s infinite;
  }
  
  .time-text {
    font-size: 72px;
    font-weight: 900;
    color: #333;
    font-family: 'Monaco', 'Courier New', Courier, monospace;
    display: block;
    line-height: 1;
    transition: all 0.3s ease;
  }
  
  .status-text {
    font-size: 14px;
    color: #999;
    margin-top: 15px;
    display: block;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.02); box-shadow: 0 0 20px rgba(255, 77, 79, 0.4); }
  100% { transform: scale(1); }
}

.setup-section {
  width: 100%;
  background-color: #fff;
  padding: 24px;
  border-radius: 24px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.03);
  
  .input-group {
    margin-bottom: 24px;
    
    .label {
      font-size: 14px;
      color: #666;
      font-weight: 600;
      margin-bottom: 16px;
      display: block;
    }
  }
}

.number-selector {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  
  .btn {
    width: 48px;
    height: 48px;
    background-color: #f0f7ff;
    color: #007aff;
    border-radius: 16px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 18px;
    font-weight: 700;
    
    &:active {
      background-color: #e1f0ff;
    }
  }
  
  .time-input {
    width: 100px;
    height: 48px;
    background-color: #f5f7fa;
    border-radius: 12px;
    text-align: center;
    font-size: 24px;
    font-weight: 700;
    color: #1a1a1a;
  }
}

.quick-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  
  .preset-chip {
    padding: 8px 16px;
    background-color: #f5f7fa;
    color: #666;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    
    &.active {
      background-color: #007aff;
      color: #fff;
    }
  }
}

.action-section {
  width: 100%;
  margin-top: 30px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  
  .big-btn {
    width: 100%;
    height: 80px;
    border-radius: 24px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 22px;
    font-weight: 800;
    transition: all 0.2s ease;
    
    &:active {
      transform: scale(0.96);
    }
  }
  
  .start-btn {
    background: linear-gradient(135deg, #007aff, #005bb7);
    color: #fff;
    box-shadow: 0 8px 25px rgba(0, 122, 255, 0.3);
  }
  
  .stop-btn {
    background: linear-gradient(135deg, #ff4d4f, #d9363e);
    color: #fff;
    box-shadow: 0 8px 25px rgba(255, 77, 79, 0.3);
  }
  
  .reset-btn {
    width: 100%;
    height: 54px;
    border-radius: 16px;
    background-color: transparent;
    color: #999;
    font-size: 16px;
    font-weight: 600;
    border: none;
    
    &::after { border: none; }
    
    &:active {
      color: #666;
    }
  }
}
</style>
