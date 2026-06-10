<template>
  <view class="container">
    <view class="status-bar"></view>
    
    <view class="header-section">
      <view class="header-left">
        <text class="page-title">个人中心</text>
        <text class="page-sub">管理您的摄入与身体数据</text>
      </view>
    </view>

    <view class="main-content">
      <!-- 每日摄入部分 -->
      <view class="section-card">
        <view class="section-header">
          <text class="section-title">每日摄入</text>
          <button class="edit-btn" @click="showIntakePopup">
            <uni-icons type="compose" size="16" color="#007aff"></uni-icons>
            <text>设置</text>
          </button>
        </view>
        
        <view class="intake-display">
          <view class="goal-tag" :class="userStore.intake.goal">
            {{ userStore.intake.goal === 'muscle' ? '当前：增肌期' : '当前：减脂期' }}
          </view>
          
          <view class="intake-grid">
            <view class="intake-item large">
              <text class="label">TDEE</text>
              <text class="value">{{ userStore.intake.tdee || 0 }}</text>
              <text class="unit">kcal</text>
            </view>
            <view class="intake-item large">
              <text class="label">每日目标</text>
              <text class="value">{{ currentCalories }}</text>
              <text class="unit">kcal</text>
            </view>
          </view>
          
          <view class="macros-row">
            <view class="macro-item">
              <text class="label">碳水</text>
              <text class="value">{{ currentMacros.carb }}g</text>
            </view>
            <view class="macro-item">
              <text class="label">蛋白质</text>
              <text class="value">{{ currentMacros.protein }}g</text>
            </view>
            <view class="macro-item">
              <text class="label">脂肪</text>
              <text class="value">{{ currentMacros.fat }}g</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 身体数据部分 -->
      <view class="section-card">
        <view class="section-header">
          <text class="section-title">身体数据</text>
          <view class="header-btns">
            <button class="history-btn" @click="showHistoryPopup">
              <uni-icons type="list" size="16" color="#666"></uni-icons>
              <text>历史</text>
            </button>
            <button class="record-btn" @click="showBodyPopup">
              <uni-icons type="plus" size="16" color="#fff"></uni-icons>
              <text>录入</text>
            </button>
          </view>
        </view>

        <view class="body-data-list">
          <view v-for="item in bodyDataItems" :key="item.key" class="body-data-item">
            <view class="item-info">
              <text class="label">{{ item.label }}</text>
              <view class="value-wrap">
                <text class="value">{{ latestRecord[item.key] || '--' }}</text>
                <text class="unit">{{ item.unit }}</text>
              </view>
            </view>
            <view class="trend-wrap" v-if="getTrend(item.key) !== 0">
              <uni-icons 
                :type="getTrend(item.key) > 0 ? 'arrow-up' : 'arrow-down'" 
                size="16" 
                :color="getTrend(item.key) > 0 ? '#ff4d4f' : '#52c41a'"
              ></uni-icons>
              <text class="trend-value" :style="{ color: getTrend(item.key) > 0 ? '#ff4d4f' : '#52c41a' }">
                {{ Math.abs(getTrend(item.key)).toFixed(1) }}
              </text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 每日摄入设置弹窗 -->
    <uni-popup ref="intakePopup" type="bottom">
      <view class="popup-content intake-form">
        <view class="popup-header">
          <text class="title">摄入设置</text>
          <uni-icons type="closeempty" size="20" color="#999" @click="intakePopup.close()"></uni-icons>
        </view>
        
        <scroll-view scroll-y="true" class="form-body">
          <uni-forms :modelValue="intakeForm" label-position="top" label-width="200">
            <uni-forms-item label="TDEE (总每日能量消耗)" name="tdee">
              <uni-easyinput type="digit" v-model="intakeForm.tdee" placeholder="请输入 TDEE" :focus="focusField === 'tdee'" @clear="setFocus('tdee')" />
            </uni-forms-item>
            
            <uni-forms-item label="当前阶段" name="goal">
              <uni-data-checkbox v-model="intakeForm.goal" :localdata="[{text:'增肌期', value:'muscle'}, {text:'减脂期', value:'fat'}]" />
            </uni-forms-item>

            <view class="form-divider">增肌期设定</view>
            <uni-forms-item label="每日热量 (kcal)" name="muscle_calories">
              <uni-easyinput type="digit" v-model="intakeForm.muscle_calories" placeholder="增肌期热量" :focus="focusField === 'muscle_calories'" @clear="setFocus('muscle_calories')" />
            </uni-forms-item>
            <view class="macros-input-row">
              <uni-forms-item label="碳水 (g)" class="macro-input">
                <uni-easyinput type="digit" v-model="intakeForm.muscle_carb" :focus="focusField === 'muscle_carb'" @clear="setFocus('muscle_carb')" />
              </uni-forms-item>
              <uni-forms-item label="蛋白 (g)" class="macro-input">
                <uni-easyinput type="digit" v-model="intakeForm.muscle_protein" :focus="focusField === 'muscle_protein'" @clear="setFocus('muscle_protein')" />
              </uni-forms-item>
              <uni-forms-item label="脂肪 (g)" class="macro-input">
                <uni-easyinput type="digit" v-model="intakeForm.muscle_fat" :focus="focusField === 'muscle_fat'" @clear="setFocus('muscle_fat')" />
              </uni-forms-item>
            </view>

            <view class="form-divider">减脂期设定</view>
            <uni-forms-item label="每日热量 (kcal)" name="fat_calories">
              <uni-easyinput type="digit" v-model="intakeForm.fat_calories" placeholder="减脂期热量" :focus="focusField === 'fat_calories'" @clear="setFocus('fat_calories')" />
            </uni-forms-item>
            <view class="macros-input-row">
              <uni-forms-item label="碳水 (g)" class="macro-input">
                <uni-easyinput type="digit" v-model="intakeForm.fat_carb" :focus="focusField === 'fat_carb'" @clear="setFocus('fat_carb')" />
              </uni-forms-item>
              <uni-forms-item label="蛋白 (g)" class="macro-input">
                <uni-easyinput type="digit" v-model="intakeForm.fat_protein" :focus="focusField === 'fat_protein'" @clear="setFocus('fat_protein')" />
              </uni-forms-item>
              <uni-forms-item label="脂肪 (g)" class="macro-input">
                <uni-easyinput type="digit" v-model="intakeForm.fat_fat" :focus="focusField === 'fat_fat'" @clear="setFocus('fat_fat')" />
              </uni-forms-item>
            </view>
          </uni-forms>
        </scroll-view>
        
        <view class="popup-footer">
          <button class="save-btn" @click="saveIntake">保存设置</button>
        </view>
      </view>
    </uni-popup>

    <!-- 身体数据录入弹窗 -->
    <uni-popup ref="bodyPopup" type="bottom">
      <view class="popup-content body-form">
        <view class="popup-header">
          <text class="title">录入身体数据</text>
          <uni-icons type="closeempty" size="20" color="#999" @click="bodyPopup.close()"></uni-icons>
        </view>
        
        <scroll-view scroll-y="true" class="form-body">
          <uni-forms :modelValue="bodyForm" label-position="top" label-width="200">
            <uni-forms-item label="记录日期" name="record_date">
              <uni-datetime-picker type="date" v-model="bodyForm.record_date" :clear-icon="false" />
            </uni-forms-item>
            <uni-forms-item label="体重 (KG)" name="weight">
              <uni-easyinput type="digit" v-model="bodyForm.weight" :focus="focusField === 'weight'" @clear="setFocus('weight')" />
            </uni-forms-item>
            <view class="form-grid">
              <uni-forms-item label="胸围 (cm)" name="chest">
                <uni-easyinput type="digit" v-model="bodyForm.chest" :focus="focusField === 'chest'" @clear="setFocus('chest')" />
              </uni-forms-item>
              <uni-forms-item label="腰围 (cm)" name="waist">
                <uni-easyinput type="digit" v-model="bodyForm.waist" :focus="focusField === 'waist'" @clear="setFocus('waist')" />
              </uni-forms-item>
              <uni-forms-item label="大腿围 (cm)" name="thigh">
                <uni-easyinput type="digit" v-model="bodyForm.thigh" :focus="focusField === 'thigh'" @clear="setFocus('thigh')" />
              </uni-forms-item>
              <uni-forms-item label="臂围 (cm)" name="arm">
                <uni-easyinput type="digit" v-model="bodyForm.arm" :focus="focusField === 'arm'" @clear="setFocus('arm')" />
              </uni-forms-item>
            </view>
          </uni-forms>
        </scroll-view>
        
        <view class="popup-footer">
          <button class="save-btn" @click="saveBodyRecord">保存数据</button>
        </view>
      </view>
    </uni-popup>
  </view>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { useUserStore } from '@/stores/user.js';

const userStore = useUserStore();

const intakePopup = ref(null);
const bodyPopup = ref(null);

const intakeForm = reactive({
  tdee: '',
  goal: 'muscle',
  muscle_calories: '',
  muscle_carb: '',
  muscle_protein: '',
  muscle_fat: '',
  fat_calories: '',
  fat_carb: '',
  fat_protein: '',
  fat_fat: ''
});

const bodyForm = reactive({
  weight: '',
  chest: '',
  waist: '',
  thigh: '',
  arm: '',
  record_date: new Date().toISOString().split('T')[0]
});

// 聚焦控制
const focusField = ref('');
const setFocus = (field) => {
  focusField.value = '';
  setTimeout(() => {
    focusField.value = field;
  }, 50);
};

const bodyDataItems = [
  { label: '体重', key: 'weight', unit: 'KG' },
  { label: '胸围', key: 'chest', unit: 'cm' },
  { label: '腰围', key: 'waist', unit: 'cm' },
  { label: '大腿围', key: 'thigh', unit: 'cm' },
  { label: '臂围', key: 'arm', unit: 'cm' }
];

onMounted(async () => {
  await userStore.fetchIntake();
  await userStore.fetchBodyRecords();
});

const currentCalories = computed(() => {
  return userStore.intake.goal === 'muscle' 
    ? userStore.intake.muscle_calories 
    : userStore.intake.fat_calories;
});

const currentMacros = computed(() => {
  if (userStore.intake.goal === 'muscle') {
    return {
      carb: userStore.intake.muscle_carb,
      protein: userStore.intake.muscle_protein,
      fat: userStore.intake.muscle_fat
    };
  } else {
    return {
      carb: userStore.intake.fat_carb,
      protein: userStore.intake.fat_protein,
      fat: userStore.intake.fat_fat
    };
  }
});

const latestRecord = computed(() => {
  return userStore.bodyRecords.length > 0 ? userStore.bodyRecords[0] : {};
});

const previousRecord = computed(() => {
  return userStore.bodyRecords.length > 1 ? userStore.bodyRecords[1] : {};
});

const getTrend = (key) => {
  const current = latestRecord.value[key];
  const prev = previousRecord.value[key];
  if (current && prev) {
    return current - prev;
  }
  return 0;
};

const showIntakePopup = () => {
  const data = { ...userStore.intake };
  // 将 0 转换为 '' 以便用户直接录入
  Object.keys(data).forEach(key => {
    if (typeof data[key] === 'number' && data[key] === 0) {
      data[key] = '';
    }
  });
  Object.assign(intakeForm, data);
  intakePopup.value.open();
};

const saveIntake = async () => {
  const dataToSave = { ...intakeForm };
  // 保存时将空字符串转回 0
  Object.keys(dataToSave).forEach(key => {
    if (key !== 'goal' && dataToSave[key] === '') {
      dataToSave[key] = 0;
    }
  });
  await userStore.saveIntake(dataToSave);
  intakePopup.value.close();
  uni.showToast({ title: '保存成功', icon: 'success' });
};

const showBodyPopup = () => {
  const fields = ['weight', 'chest', 'waist', 'thigh', 'arm'];
  fields.forEach(field => {
    bodyForm[field] = latestRecord.value[field] || '';
    // 如果是 0 也转为空字符串
    if (bodyForm[field] === 0) bodyForm[field] = '';
  });
  bodyForm.record_date = new Date().toISOString().split('T')[0];
  bodyPopup.value.open();
};

const saveBodyRecord = async () => {
  await userStore.addBodyRecord({ ...bodyForm });
  bodyPopup.value.close();
  uni.showToast({ title: '记录成功', icon: 'success' });
};

const showHistoryPopup = () => {
  uni.navigateTo({
    url: '/pages/my/body-history'
  });
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};
</script>

<style lang="scss" scoped>
.container {
  padding-bottom: 120rpx;
}

.status-bar {
  height: var(--status-bar-height);
  width: 100%;
}

.header-section {
  padding: 40rpx 30rpx;
  background: linear-gradient(135deg, #007aff 0%, #0056b3 100%);
  color: #fff;
  
  .page-title {
    font-size: 44rpx;
    font-weight: bold;
    display: block;
  }
  
  .page-sub {
    font-size: 24rpx;
    opacity: 0.8;
    margin-top: 8rpx;
    display: block;
  }
}

.main-content {
  padding: 30rpx;
  margin-top: -20rpx;
}

.section-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.05);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30rpx;
  
  .section-title {
    font-size: 32rpx;
    font-weight: bold;
    color: #333;
  }
  
  .header-btns {
    display: flex;
    gap: 16rpx;
  }
}

.edit-btn, .history-btn, .record-btn {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 0 24rpx;
  height: 56rpx;
  border-radius: 28rpx;
  font-size: 24rpx;
  margin: 0;
  line-height: 56rpx;
  
  &::after { border: none; }
}

.edit-btn {
  background: #e1f0ff;
  color: #007aff;
}

.history-btn {
  background: #f0f0f0;
  color: #666;
}

.record-btn {
  background: #007aff;
  color: #fff;
}

/* 每日摄入样式 */
.intake-display {
  .goal-tag {
    display: inline-block;
    padding: 6rpx 20rpx;
    border-radius: 8rpx;
    font-size: 22rpx;
    margin-bottom: 24rpx;
    
    &.muscle { background: #fff1f0; color: #f5222d; }
    &.fat { background: #f6ffed; color: #52c41a; }
  }
  
  .intake-grid {
    display: flex;
    gap: 30rpx;
    margin-bottom: 30rpx;
  }
  
  .intake-item {
    flex: 1;
    background: #f8f9fa;
    padding: 24rpx;
    border-radius: 16rpx;
    text-align: center;
    
    .label { font-size: 24rpx; color: #999; display: block; margin-bottom: 8rpx; }
    .value { font-size: 40rpx; font-weight: bold; color: #333; }
    .unit { font-size: 20rpx; color: #999; margin-left: 4rpx; }
  }
  
  .macros-row {
    display: flex;
    justify-content: space-around;
    border-top: 1rpx solid #eee;
    padding-top: 24rpx;
    
    .macro-item {
      text-align: center;
      .label { font-size: 22rpx; color: #999; display: block; margin-bottom: 4rpx; }
      .value { font-size: 28rpx; font-weight: 500; color: #333; }
    }
  }
}

/* 身体数据列表样式 */
.body-data-list {
  .body-data-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 24rpx 0;
    border-bottom: 1rpx solid #f0f0f0;
    
    &:last-child { border-bottom: none; }
  }
  
  .item-info {
    display: flex;
    align-items: center;
    .label { 
      font-size: 28rpx; 
      color: #666; 
      width: 120rpx; /* 固定宽度确保对齐 */
    }
    .value-wrap {
      display: inline-flex;
      align-items: baseline;
      .value { font-size: 32rpx; font-weight: bold; color: #333; }
      .unit { font-size: 22rpx; color: #999; margin-left: 6rpx; }
    }
  }
  
  .trend-wrap {
    display: flex;
    align-items: center;
    gap: 4rpx;
    
    .trend-value { font-size: 24rpx; font-weight: 500; }
  }
}

/* 弹窗样式 */
.popup-content {
  background: #fff;
  border-radius: 32rpx 32rpx 0 0;
  padding: 40rpx 30rpx 0 30rpx; /* 底部 padding 移到 footer */
  height: 80vh; /* 固定高度确保 flex 布局生效 */
  display: flex;
  flex-direction: column;
  position: relative;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40rpx;
  
  .title { font-size: 36rpx; font-weight: bold; color: #333; }
}

.form-body {
  flex: 1;
  overflow: hidden;
  
  :deep(.uni-forms-item__label) {
    white-space: nowrap !important;
    overflow: visible !important;
  }
}

.form-divider {
  font-size: 24rpx;
  color: #999;
  background: #f5f7fa;
  padding: 10rpx 20rpx;
  border-radius: 8rpx;
  margin: 20rpx 0;
}

.macros-input-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20rpx;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 30rpx;
}

.popup-footer {
  padding: 30rpx 0;
  padding-bottom: calc(120rpx + env(safe-area-inset-bottom)); /* 增加底部间距以避开 TabBar */
  background: #fff;
  border-top: 1rpx solid #eee;
  .save-btn {
    background: #007aff;
    color: #fff;
    border-radius: 44rpx;
    font-size: 32rpx;
    height: 88rpx;
    line-height: 88rpx;
    &::after { border: none; }
  }
}

.history-body {
  height: 60vh;
}
</style>
