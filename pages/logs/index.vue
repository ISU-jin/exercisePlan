<template>
  <view class="container">
    <view class="status-bar"></view>
    
    <view class="header-section">
      <view class="title-wrapper">
        <text class="main-title">运动记录</text>
        <text class="sub-title">回顾您的每一次进步</text>
      </view>
      <uni-datetime-picker type="date" @change="onDateSelect" :border="false">
        <view class="filter-btn">
          <uni-icons type="calendar" size="20" color="#007aff"></uni-icons>
        </view>
      </uni-datetime-picker>
    </view>

    <view class="content-body">
      <view v-if="groupedLogs.length === 0" class="empty-state">
        <uni-icons type="info" size="48" color="#eee"></uni-icons>
        <text>尚未有运动记录</text>
        <text class="empty-sub">开启您的第一场训练吧</text>
      </view>

      <view v-else class="log-list">
        <view v-for="group in groupedLogs" :key="group.date" class="log-group-card">
          <view class="group-header">
            <view class="date-info">
              <text class="day">{{ getDay(group.date) }}</text>
              <text class="month-year">{{ getMonthYear(group.date) }}</text>
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
                    <text class="action-name">{{ action.action_name }}</text>
                    
                    <view v-if="action.category === '有氧' || action.category === '核心'" class="cardio-note">
                      <text>{{ action.note || '未填写内容' }}</text>
                    </view>
                    <view v-else class="action-data">
                      <view class="data-pill">{{ action.sets }} 组</view>
                      <view class="data-pill">{{ action.reps }} 次</view>
                      <view class="data-pill weight">{{ action.weight }} KG</view>
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
  </view>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useLogStore } from '@/stores/log.js';

const logStore = useLogStore();
const loadStatus = ref('more');
const page = ref(0);
const pageSize = 20;

const groupedLogs = computed(() => {
  const groups = {};
  logStore.logs.forEach(log => {
    if (!groups[log.date]) {
      groups[log.date] = {
        date: log.date,
        categories: {}
      };
    }
    
    const cat = log.category || '其他';
    if (!groups[log.date].categories[cat]) {
      groups[log.date].categories[cat] = [];
    }
    groups[log.date].categories[cat].push(log);
  });
  
  return Object.values(groups).map(group => ({
    ...group,
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
  
  await logStore.fetchLogs(pageSize, page.value * pageSize);
  
  if (logStore.logs.length < (page.value + 1) * pageSize) {
    loadStatus.value = 'noMore';
  } else {
    loadStatus.value = 'more';
  }
};

onMounted(() => {
  fetchLogs(true);
});

const loadMore = () => {
  if (loadStatus.value === 'more') {
    page.value++;
    fetchLogs();
  }
};

const onDateSelect = (date) => {
  if (date) {
    uni.showToast({ title: '已筛选日期: ' + date, icon: 'none' });
  }
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

  .filter-btn {
    width: 44px;
    height: 44px;
    background-color: #fff;
    border-radius: 14px;
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
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
    border-radius: 24px;
    margin-bottom: 20px;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);
    
    .group-header {
      padding: 20px 24px 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      
      .date-info {
        .day {
          font-size: 24px;
          font-weight: 900;
          color: #1a1a1a;
          margin-right: 8px;
        }
        .month-year {
          font-size: 13px;
          color: #999;
          font-weight: 600;
        }
      }
    }

    .cat-groups {
      padding: 0 20px 20px;
    }

    .cat-sub-group {
      margin-top: 15px;
      .cat-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 800;
        margin-bottom: 10px;
        text-transform: uppercase;
        .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
      }
    }
    
    .action-items {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    
    .action-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 16px;
      background-color: #f8f9fb;
      border-radius: 16px;
      
      .action-name {
        font-size: 15px;
        font-weight: 700;
        color: #333;
        display: block;
        margin-bottom: 6px;
      }
      
      .action-data {
        display: flex;
        gap: 6px;
        
        .data-pill {
          font-size: 10px;
          font-weight: 700;
          color: #666;
          background-color: #fff;
          padding: 2px 8px;
          border-radius: 6px;
          
          &.weight {
            background-color: #eef6ff;
            color: #007aff;
          }
        }
      }

      .cardio-note {
        font-size: 13px;
        color: #666;
        line-height: 1.4;
        background-color: #fff;
        padding: 8px 12px;
        border-radius: 8px;
        border-left: 3px solid #13c2c2;
      }
    }
  }

.custom-load-more {
  margin-top: 20px;
}
</style>
