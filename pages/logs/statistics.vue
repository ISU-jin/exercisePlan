<template>
  <view class="container">
    <view class="status-bar"></view>
    
    <view class="header">
      <view class="back-btn" @click="goBack">
        <uni-icons type="left" size="24" color="#333"></uni-icons>
      </view>
      <text class="title">训练量统计</text>
      <view class="placeholder"></view>
    </view>

    <view class="date-selector">
      <uni-datetime-picker v-model="chartDateRange" type="daterange" @change="onChartDateChange">
        <view class="date-display">
          <uni-icons type="calendar" size="20" color="#007aff"></uni-icons>
          <text class="date-text">{{ chartDateLabel }}</text>
          <uni-icons type="bottom" size="14" color="#999"></uni-icons>
        </view>
      </uni-datetime-picker>
    </view>

    <scroll-view scroll-y="true" class="content-scroll">
      <view class="stats-card chart-card">
        <view v-if="chartData.series && chartData.series.length > 0" class="chart-box">
          <canvas canvas-id="volumeChart" id="volumeChart" class="charts" @touchstart="touchPie"></canvas>
          <view class="volume-total">
            <text class="total-label">总训练量</text>
            <text class="total-value">{{ totalVolume }}</text>
          </view>
        </view>
        <view v-else class="empty-chart">
          <uni-icons type="info" size="48" color="#eee"></uni-icons>
          <text>该时间段内无训练记录</text>
        </view>
      </view>

      <view v-if="chartData.series && chartData.series.length > 0" class="list-section">
        <view class="section-title">详细占比</view>
        <view class="stats-list">
          <view v-for="(item, index) in sortedStats" :key="index" class="stats-item">
            <view class="item-left">
              <view class="color-dot" :style="{ backgroundColor: getColor(index) }"></view>
              <text class="item-name">{{ item.name }}</text>
            </view>
            <view class="item-right">
              <view class="item-values">
                <text class="item-volume">{{ item.data }}</text>
                <text class="item-percent">{{ item.percent }}%</text>
              </view>
              <view class="progress-bg">
                <view class="progress-bar" :style="{ width: item.percent + '%', backgroundColor: getColor(index) }"></view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, onMounted, computed, getCurrentInstance } from 'vue';
import { useLogStore } from '@/stores/log.js';
import uCharts from '@qiun/ucharts';

const logStore = useLogStore();
const instance = getCurrentInstance();

const chartDateRange = ref([]);
const chartData = ref({ series: [] });
const totalVolume = ref(0);
let uChartsInstance = null;

const chartDateLabel = computed(() => {
  if (chartDateRange.value && chartDateRange.value.length === 2) {
    return `${chartDateRange.value[0]} 至 ${chartDateRange.value[1]}`;
  }
  return '选择时间范围';
});

const sortedStats = computed(() => {
  if (!chartData.value.series) return [];
  return [...chartData.value.series].map(item => ({
    ...item,
    percent: totalVolume.value > 0 ? ((item.data / totalVolume.value) * 100).toFixed(1) : 0
  })).sort((a, b) => b.data - a.data);
});

const chartColors = ["#1890FF","#91CB74","#FAC858","#EE6666","#73C0DE","#3BA272","#FC8452","#9A60B4","#ea7ccc"];
const getColor = (index) => chartColors[index % chartColors.length];

onMounted(() => {
  const end = new Date();
  const start = new Date();
  start.setTime(start.getTime() - 3600 * 1000 * 24 * 7);
  const formatDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  chartDateRange.value = [formatDate(start), formatDate(end)];
  calculateVolumeData();
});

const goBack = () => {
  uni.navigateBack();
};

const onChartDateChange = () => {
  calculateVolumeData();
};

const calculateVolumeData = async () => {
  if (!chartDateRange.value || chartDateRange.value.length !== 2) return;
  
  const [startDate, endDate] = chartDateRange.value;
  const logs = await logStore.fetchLogsByRange(startDate, endDate);
  
  const categoryVolumes = {};
  let total = 0;
  
  logs.forEach(log => {
    let volume = 0;
    const reps = log.reps || 0;
    const sets = log.sets || 0;
    const weight = log.weight || 0;
    const repsDetail = log.reps_detail || '';
    
    if (repsDetail) {
      const repsArray = repsDetail.split(',').map(Number);
      const totalReps = repsArray.reduce((a, b) => a + b, 0);
      volume = totalReps * weight;
    } else {
      volume = sets * reps * weight;
    }
    
    if (volume > 0) {
      const cat = log.category || '其他';
      categoryVolumes[cat] = (categoryVolumes[cat] || 0) + volume;
      total += volume;
    }
  });
  
  totalVolume.value = Math.round(total);
  
  const series = Object.keys(categoryVolumes).map(cat => ({
    name: cat,
    data: categoryVolumes[cat]
  }));
  
  chartData.value = { series };
  
  if (series.length > 0) {
    setTimeout(() => {
      renderChart();
    }, 100);
  }
};

const renderChart = () => {
  const ctx = uni.createCanvasContext('volumeChart', instance);
  uChartsInstance = new uCharts({
    type: "pie",
    context: ctx,
    width: uni.upx2px(690),
    height: uni.upx2px(500),
    series: chartData.value.series,
    animation: true,
    timing: "easeOut",
    duration: 800,
    fontSize: 12,
    background: "#FFFFFF",
    color: chartColors,
    padding: [5,5,5,5],
    enableScroll: false,
    extra: {
      pie: {
        activeOpacity: 0.5,
        activeRadius: 10,
        offsetAngle: 0,
        labelWidth: 15,
        border: true,
        borderWidth: 3,
        borderColor: "#FFFFFF"
      }
    }
  });
};

const touchPie = (e) => {
  if (uChartsInstance) {
    uChartsInstance.showToolTip(e, {
      format: function (item) {
        return item.name + ':' + item.data 
      }
    });
  }
};
</script>

<style lang="scss" scoped>
.container {
  display: flex;
  flex-direction: column;
}

.status-bar {
  height: var(--status-bar-height);
  background-color: #fff;
}

.header {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 15px;
  background-color: #fff;
  
  .title {
    font-size: 18px;
    font-weight: bold;
    color: #333;
  }
  
  .back-btn, .placeholder {
    width: 40px;
  }
}

.date-selector {
  background-color: #fff;
  padding: 10px 15px;
  border-bottom: 1px solid #f0f0f0;
  
  .date-display {
    display: flex;
    align-items: center;
    background-color: #f5f7fa;
    padding: 8px 15px;
    border-radius: 20px;
    gap: 8px;
    
    .date-text {
      flex: 1;
      font-size: 14px;
      color: #333;
    }
  }
}

.content-scroll {
  flex: 1;
  overflow: hidden;
}

.stats-card {
  background-color: #fff;
  margin: 15px;
  padding: 20px;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.chart-box {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.charts {
  width: 690rpx;
  height: 500rpx;
  background-color: #FFFFFF;
}

.volume-total {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #f0f7ff;
  padding: 15px 40px;
  border-radius: 16px;
  
  .total-label {
    font-size: 14px;
    color: #666;
  }
  
  .total-value {
    font-size: 24px;
    font-weight: bold;
    color: #007aff;
    margin-top: 4px;
  }
}

.empty-chart {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: #999;
  font-size: 14px;
  gap: 12px;
}

.list-section {
  padding: 0 15px 30px;
  
  .section-title {
    font-size: 16px;
    font-weight: bold;
    color: #333;
    margin-bottom: 15px;
    padding-left: 5px;
  }
}

.stats-list {
  background-color: #fff;
  border-radius: 16px;
  padding: 10px 15px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.stats-item {
  display: flex;
  align-items: center;
  padding: 15px 0;
  border-bottom: 1px solid #f8f9fb;
  
  &:last-child {
    border-bottom: none;
  }
  
  .item-left {
    width: 100px;
    display: flex;
    align-items: center;
    gap: 10px;
    
    .color-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    
    .item-name {
      font-size: 14px;
      color: #333;
      font-weight: 500;
    }
  }
  
  .item-right {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    
    .item-values {
      display: flex;
      justify-content: space-between;
      align-items: center;
      
      .item-volume {
        font-size: 14px;
        color: #666;
      }
      
      .item-percent {
        font-size: 14px;
        color: #333;
        font-weight: bold;
      }
    }
    
    .progress-bg {
      height: 6px;
      background-color: #f5f7fa;
      border-radius: 3px;
      overflow: hidden;
      
      .progress-bar {
        height: 100%;
        border-radius: 3px;
        transition: width 0.6s ease;
      }
    }
  }
}
</style>