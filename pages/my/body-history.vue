<template>
  <view class="container">
    <view class="status-bar"></view>
    
    <view class="header-section">
      <view class="back-btn" @click="goBack">
        <uni-icons type="left" size="24" color="#333"></uni-icons>
      </view>
      <text class="page-title">身体数据历史</text>
      <view class="header-right"></view>
    </view>

    <view class="filter-section">
      <view class="time-picker-wrap">
        <uni-datetime-picker
          v-model="range"
          type="daterange"
          @change="onRangeChange"
          :clear-icon="false"
          :end="todayStr"
        >
          <view class="date-display">
            <uni-icons type="calendar" size="16" color="#007aff"></uni-icons>
            <text>{{ rangeText }}</text>
          </view>
        </uni-datetime-picker>
      </view>
      
      <scroll-view scroll-x class="quick-options">
        <view 
          v-for="opt in quickOptions" 
          :key="opt.value" 
          class="opt-tag" 
          :class="{ active: currentQuick === opt.value }"
          @click="selectQuick(opt.value)"
        >
          {{ opt.label }}
        </view>
      </scroll-view>
    </view>

    <view class="view-toggle">
      <view 
        class="toggle-item" 
        :class="{ active: viewMode === 'card' }"
        @click="viewMode = 'card'"
      >
        <uni-icons type="list" size="18" :color="viewMode === 'card' ? '#007aff' : '#666'"></uni-icons>
        <text>卡片视图</text>
      </view>
      <view 
        class="toggle-item" 
        :class="{ active: viewMode === 'chart' }"
        @click="viewMode = 'chart'"
      >
        <uni-icons type="pulldown" size="18" :color="viewMode === 'chart' ? '#007aff' : '#666'"></uni-icons>
        <text>图表视图</text>
      </view>
    </view>

    <view class="content-body">
      <!-- 卡片视图 -->
      <view v-if="viewMode === 'card'" class="card-list">
        <view v-if="filteredRecords.length === 0" class="empty-state">
          <uni-icons type="info" size="48" color="#eee"></uni-icons>
          <text>该时间段暂无记录</text>
        </view>
        <view v-for="record in filteredRecords" :key="record.id" class="history-card">
          <view class="card-header">
            <view class="date-badge">
              <uni-icons type="calendar-filled" size="16" color="#007aff"></uni-icons>
              <text class="date">{{ record.record_date }}</text>
            </view>
          </view>
          <view class="card-content">
            <view v-for="m in metrics" :key="m.key" class="data-box">
              <view class="box-top">
                <text class="label">{{ m.label }}</text>
                <view v-if="record.trends && record.trends[m.key]" class="trend-mini">
                  <uni-icons 
                    :type="record.trends[m.key] > 0 ? 'arrow-up' : 'arrow-down'" 
                    size="10" 
                    :color="record.trends[m.key] > 0 ? '#ff4d4f' : '#52c41a'"
                  ></uni-icons>
                  <text :style="{ color: record.trends[m.key] > 0 ? '#ff4d4f' : '#52c41a' }">
                    {{ Math.abs(record.trends[m.key]).toFixed(1) }}
                  </text>
                </view>
              </view>
              <view class="box-bottom">
                <text class="value">{{ record[m.key] || '--' }}</text>
                <text class="unit">{{ m.unit }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 图表视图 -->
      <view v-if="viewMode === 'chart'" class="chart-view">
        <view class="metric-selector">
          <scroll-view scroll-x class="metric-scroll">
            <view 
              v-for="item in metrics" 
              :key="item.key" 
              class="metric-tag"
              :class="{ active: currentMetric === item.key }"
              @click="currentMetric = item.key"
            >
              {{ item.label }}
            </view>
          </scroll-view>
        </view>
        
        <view v-if="filteredRecords.length > 0" class="chart-container">
          <canvas 
            canvas-id="bodyChart" 
            id="bodyChart" 
            class="charts" 
            @touchstart="touchChart"
          ></canvas>
        </view>
        <view v-else class="empty-state chart-empty">
          <uni-icons type="info" size="48" color="#eee"></uni-icons>
          <text>该时间段暂无记录</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, watch, getCurrentInstance } from 'vue';
import { useUserStore } from '@/stores/user.js';
import uCharts from '@qiun/ucharts';

const userStore = useUserStore();
const instance = getCurrentInstance();

const todayStr = new Date().toISOString().split('T')[0];
const range = ref([]);
const currentQuick = ref('1m');
const viewMode = ref('card');
const currentMetric = ref('weight');
let uChartsInstance = null;

const quickOptions = [
  { label: '近一个月', value: '1m' },
  { label: '近三个月', value: '3m' },
  { label: '近半年', value: '6m' },
  { label: '近一年', value: '1y' },
  { label: '全部', value: 'all' }
];

const metrics = [
  { label: '体重', key: 'weight', unit: 'KG' },
  { label: '胸围', key: 'chest', unit: 'cm' },
  { label: '腰围', key: 'waist', unit: 'cm' },
  { label: '大腿围', key: 'thigh', unit: 'cm' },
  { label: '臂围', key: 'arm', unit: 'cm' }
];

const rangeText = computed(() => {
  if (range.value.length === 2) {
    return `${range.value[0]} 至 ${range.value[1]}`;
  }
  return '选择时间范围';
});

const filteredRecords = computed(() => {
  const allRecords = [...userStore.bodyRecords].sort((a, b) => new Date(b.record_date) - new Date(a.record_date));
  
  let records = allRecords;
  if (range.value.length === 2) {
    const start = new Date(range.value[0]).getTime();
    const end = new Date(range.value[1]).getTime() + 86400000;
    records = allRecords.filter(r => {
      const t = new Date(r.record_date).getTime();
      return t >= start && t <= end;
    });
  }

  // 计算每一条记录相对于其“前一时间点”记录的趋势
  return records.map((record, index) => {
    const trends = {};
    // 在全量记录中找到该记录的下一条（即时间上更早的一条）
    const recordIndex = allRecords.findIndex(r => r.id === record.id);
    const prevRecord = allRecords[recordIndex + 1];

    if (prevRecord) {
      metrics.forEach(m => {
        const currentVal = record[m.key];
        const prevVal = prevRecord[m.key];
        if (currentVal && prevVal) {
          trends[m.key] = currentVal - prevVal;
        }
      });
    }

    return {
      ...record,
      trends
    };
  });
});

const selectQuick = (val) => {
  currentQuick.value = val;
  const now = new Date();
  const start = new Date();
  
  if (val === '1m') start.setMonth(now.getMonth() - 1);
  else if (val === '3m') start.setMonth(now.getMonth() - 3);
  else if (val === '6m') start.setMonth(now.getMonth() - 6);
  else if (val === '1y') start.setFullYear(now.getFullYear() - 1);
  else if (val === 'all') {
    range.value = [];
    return;
  }
  
  range.value = [
    start.toISOString().split('T')[0],
    now.toISOString().split('T')[0]
  ];
};

const onRangeChange = () => {
  currentQuick.value = '';
};

const goBack = () => {
  uni.navigateBack();
};

onMounted(async () => {
  if (userStore.bodyRecords.length === 0) {
    await userStore.fetchBodyRecords();
  }
  selectQuick('1m');
});

// 图表渲染逻辑
const renderChart = () => {
  if (viewMode.value !== 'chart' || filteredRecords.value.length === 0) {
    uChartsInstance = null;
    return;
  }

  const sorted = [...filteredRecords.value].sort((a, b) => new Date(a.record_date) - new Date(b.record_date));
  const categories = sorted.map(r => {
    const d = new Date(r.record_date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });
  const data = sorted.map(r => r[currentMetric.value] || 0);

  const ctx = uni.createCanvasContext('bodyChart', instance);
  uChartsInstance = new uCharts({
    type: "line",
    context: ctx,
    width: uni.upx2px(690),
    height: uni.upx2px(500),
    categories: categories,
    series: [
      {
        name: metrics.find(m => m.key === currentMetric.value).label,
        data: data
      }
    ],
    animation: true,
    timing: "easeOut",
    duration: 800,
    fontSize: 12,
    background: "#FFFFFF",
    color: ["#1890FF"],
    padding: [15, 15, 0, 15],
    enableScroll: false,
    legend: { show: false },
    xAxis: {
      disableGrid: true,
      labelCount: 4
    },
    yAxis: {
      gridType: "dash",
      dashLength: 2,
      splitNumber: 5
    },
    extra: {
      line: {
        type: "curve",
        width: 2,
        activeType: "hollow"
      }
    }
  });
};

const touchChart = (e) => {
  if (uChartsInstance) {
    uChartsInstance.showToolTip(e, {
      format: function (item) {
        return item.name + ':' + item.data 
      }
    });
  }
};

// 监听数据变化重新渲染图表
watch([viewMode, currentMetric, filteredRecords], () => {
  if (viewMode.value === 'chart') {
    setTimeout(() => {
      renderChart();
    }, 100);
  }
}, { deep: true });

</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background-color: #f8f9fa;
  padding-bottom: 40rpx;
}

.status-bar {
  height: var(--status-bar-height);
  background-color: #fff;
}

.header-section {
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30rpx;
  background-color: #fff;
  position: sticky;
  top: var(--status-bar-height);
  z-index: 100;
  
  .back-btn {
    width: 60rpx;
  }
  
  .page-title {
    font-size: 32rpx;
    font-weight: bold;
    color: #333;
  }
  
  .header-right {
    width: 60rpx;
  }
}

.filter-section {
  background-color: #fff;
  padding: 20rpx 30rpx;
  border-bottom: 1rpx solid #eee;
  
  .time-picker-wrap {
    margin-bottom: 20rpx;
    
    .date-display {
      height: 72rpx;
      background: #f5f7fa;
      border-radius: 12rpx;
      display: flex;
      align-items: center;
      padding: 0 24rpx;
      gap: 12rpx;
      
      text {
        font-size: 26rpx;
        color: #333;
      }
    }
  }
  
  .quick-options {
    white-space: nowrap;
    
    .opt-tag {
      display: inline-block;
      padding: 10rpx 24rpx;
      background: #f5f7fa;
      border-radius: 30rpx;
      font-size: 24rpx;
      color: #666;
      margin-right: 16rpx;
      
      &.active {
        background: #e1f0ff;
        color: #007aff;
        font-weight: 500;
      }
    }
  }
}

.view-toggle {
  display: flex;
  background: #fff;
  margin: 20rpx 30rpx;
  border-radius: 16rpx;
  padding: 8rpx;
  
  .toggle-item {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8rpx;
    height: 64rpx;
    border-radius: 12rpx;
    font-size: 26rpx;
    color: #666;
    transition: all 0.2s;
    
    &.active {
      background: #f0f7ff;
      color: #007aff;
      font-weight: bold;
    }
  }
}

.content-body {
  padding: 0 30rpx;
}

.history-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 30rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.04);
  border: 1rpx solid rgba(0,0,0,0.02);
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24rpx;
    
    .date-badge {
      display: flex;
      align-items: center;
      gap: 12rpx;
      background: #f0f7ff;
      padding: 8rpx 20rpx;
      border-radius: 40rpx;
      
      .date {
        font-size: 26rpx;
        font-weight: bold;
        color: #007aff;
      }
    }
    
    .card-tag {
      font-size: 22rpx;
      color: #999;
      background: #f5f5f5;
      padding: 4rpx 16rpx;
      border-radius: 8rpx;
    }
  }
  
  .card-content {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20rpx;
    
    .data-box {
      background: #fcfcfc;
      border: 1rpx solid #f5f5f5;
      padding: 20rpx 16rpx;
      border-radius: 16rpx;
      
      .box-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 8rpx;
        
        .label {
          font-size: 22rpx;
          color: #999;
        }
        
        .trend-mini {
          display: flex;
          align-items: center;
          gap: 2rpx;
          font-size: 18rpx;
          font-weight: bold;
        }
      }
      
      .box-bottom {
        display: flex;
        align-items: baseline;
        gap: 4rpx;
        
        .value {
          font-size: 32rpx;
          font-weight: 800;
          color: #333;
        }
        
        .unit {
          font-size: 20rpx;
          color: #bbb;
        }
      }
    }
  }
}

.chart-view {
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  
  .metric-selector {
    margin-bottom: 30rpx;
    
    .metric-scroll {
      white-space: nowrap;
      
      .metric-tag {
        display: inline-block;
        padding: 8rpx 20rpx;
        border-radius: 8rpx;
        font-size: 24rpx;
        color: #666;
        margin-right: 12rpx;
        border: 1rpx solid #eee;
        
        &.active {
          background: #007aff;
          color: #fff;
          border-color: #007aff;
        }
      }
    }
  }
  
  .chart-container {
    height: 500rpx;
    
    .charts {
      width: 100%;
      height: 100%;
      background-color: #FFFFFF;
    }
  }
}

.empty-state {
  padding-top: 100rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
  color: #999;
  font-size: 26rpx;
  
  &.chart-empty {
    padding: 100rpx 0;
  }
}
</style>
