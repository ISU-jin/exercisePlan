# 运动计划管理 App 实现思路文档

## 1. 技术栈选型
- **框架**: UniApp (Vue 3 + Vite) - 支持跨端，开发效率高。
- **数据库**: SQLite3 (通过 UniApp 原生插件或 `plus.sqlite` 接口) - 实现本地持久化存储，无需服务器，数据隐私性好。
- **UI 组件库**: `uni-ui` - 官方组件库，兼容性好，风格简洁。
- **状态管理**: Pinia - 用于管理全局的计划设置、当前状态等。

## 2. 数据库设计 (SQLite3)

### 2.1 动作库表 `exercise_actions`
| 字段名 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PRIMARY KEY | 自增 ID |
| name | TEXT | 动作名称 |
| category | TEXT | 部位分类 (胸、背、腿、肩、臂等) |
| custom | INTEGER | 是否为自定义动作 (0: 预设, 1: 用户新增) |

### 2.2 计划配置表 `plan_configs`
| 字段名 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PRIMARY KEY | 自增 ID |
| split_type | INTEGER | 分化类型 (3: 三分化, 5: 五分化) |
| rest_days | INTEGER | 休息天数 (如练3休1中的1) |
| start_date | TEXT | 计划开始执行的日期 (YYYY-MM-DD) |
| is_active | INTEGER | 是否为当前激活计划 |

### 2.3 计划详情表 `plan_details`
| 字段名 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PRIMARY KEY | 自增 ID |
| plan_id | INTEGER | 关联的计划 ID |
| day_index | INTEGER | 循环中的第几天 (0-N) |
| target_group | TEXT | 当天练的部位 |
| action_ids | TEXT | 动作 ID 列表 (JSON 字符串) |
| settings | TEXT | 动作设置 (组数、次数的 JSON 字符串) |

### 2.4 运动记录表 `workout_logs`
| 字段名 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PRIMARY KEY | 自增 ID |
| date | TEXT | 训练日期 (YYYY-MM-DD) |
| action_id | INTEGER | 动作 ID |
| action_name | TEXT | 动作名称 (冗余存储，防止动作库删除后无法显示) |
| sets | INTEGER | 组数 |
| reps | INTEGER | 次数 |
| weight | REAL | 重量 (kg) |
| group_id | TEXT | 单词训练标识 (用于将一次训练的多个动作聚合) |

### 2.5 休息日/调整记录表 `schedule_adjustments`
| 字段名 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PRIMARY KEY | 自增 ID |
| adjust_date | TEXT | 发生调整的日期 |
| type | TEXT | 调整类型 (REST: 额外休息导致的顺延) |

---

## 3. 核心功能模块实现逻辑

### 3.1 首页
- **上半部分**: 实时计算。根据 `start_date`、`split_type`、`rest_days` 以及 `schedule_adjustments` 中的偏移量，计算出“今天”处于循环的哪一天，展示对应的部位和动作。
- **下半部分**: 底部导航/宫格布局，跳转至各子模块。

### 3.2 动作库
- 支持分类查看。
- 新增动作：弹出输入框，输入名称并选择部位分类，保存至 `exercise_actions`。

### 3.3 计划管理
- **分化选择**: 提供三分化/五分化的模板。
- **循环逻辑**: 
  - 三分化：[胸, 背, 腿] + 休息天数。
  - 五分化：[胸, 背, 肩, 腿, 臂] + 休息天数。
- **动作设置**: 选择某一天 -> 选择大类 -> 从动作库勾选动作 -> 输入默认组数/次数。

### 3.4 计划日历
- **日历生成算法**:
  1. 获取 `start_date`。
  2. 获取所有 `type='REST'` 的调整记录。
  3. 对于日历上的每一天 `D`：
     - 计算 `offset = (D - start_date) - (D之前的休息调整天数)`。
     - 如果 `D` 本身是“主动休息日”或循环计算出的“固定休息日”，展示休息。
     - 否则，展示循环中的动作计划。
- **打卡功能**:
  - 点击打卡 -> 弹出动作列表（预设组数/次数）。
  - 用户可修改数据并输入重量。
  - 保存后向 `workout_logs` 插入数据。
- **休息功能**:
  - 点击休息 -> 向 `schedule_adjustments` 插入一条记录。
  - 触发日历刷新，后续计划自动顺延。

### 3.5 运动记录
- SQL 查询 `workout_logs`，按 `date` 倒序。
- 分页：使用 `LIMIT` 和 `OFFSET`。
- 聚合：按 `group_id` 或 `date` 将同一次的训练动作组合展示。

---

## 4. 细节查缺补漏与优化建议

### 4.1 细节优化
- **动作录入**: 不提供预置动作库，App 初始状态为空，由用户根据自身习惯添加（如：杠铃卧推、哑铃飞鸟等）。
- **单位固定**: 统一使用 **KG** 作为重量单位，简化输入逻辑。
- **计划重置**: 提供“重置计划”功能，清空所有调整记录，从选定的新日期重新开始。
- **重量记忆**: 打卡时，自动填充该动作“上一次”的重量，减少输入成本（渐进超负荷参考）。

### 4.2 体验增强
- **图表分析**: 在运动记录模块增加简单的统计图表（如：本周训练时长、各部位训练频率分布）。
- **全局备份**: 提供“导出/导入项目数据”功能，支持将整个数据库（包含动作库、计划配置、所有历史记录）备份为 JSON 或 DB 文件，方便用户迁移数据或防止丢失。
- **UI 风格**: 建议采用深色模式（Dark Mode），符合运动健身类 App 的审美，且在健身房较暗环境下不刺眼。

### 4.3 技术细节
- **SQLite 封装**: 封装一个简单的 ORM 或 DB 工具类，处理数据库的打开、建表、版本升级。
- **性能**: 日历展示时，只计算当前月份的数据，避免一次性计算过多日期的偏移量。

---

## 5. 用户操作流程设计 (User Flow)

### 5.1 首次启动/初始化
1. 检测数据库是否存在，若不存在则创建表结构。
2. 引导用户进入“动作库”添加基础动作。
3. 引导用户进入“计划管理”设置界面：
   - 选择分化方式（三分化/五分化）。
   - 设置循环中的每一天（选择部位、从库中选择动作、设定目标组数次数）。
   - 选择“计划开始日期”。

### 5.2 日常使用 (首页/日历)
1. 首页展示今日待练内容。
2. 用户点击“打卡”：
   - 进入确认页，展示动作列表。
   - 填写实际完成重量/组数/次数。
   - 点击保存，记录存入 `workout_logs`。
3. 用户点击“休息”：
   - 弹出确认框。
   - 确认后，系统在 `schedule_adjustments` 记录今日为额外休息日。
   - 刷新日历和首页今日任务（今日变更为“休息”，原计划移至明日）。

---

## 6. 技术难点：计划顺延算法伪代码
```javascript
function getPlanForDate(targetDate) {
  const startDate = config.startDate;
  const daysDiff = diffInDays(targetDate, startDate);
  
  // 1. 找出 startDate 到 targetDate 之间的所有主动休息记录天数
  const adjustments = db.query("SELECT count(*) FROM schedule_adjustments WHERE adjust_date >= ? AND adjust_date <= ?", [startDate, targetDate]);
  
  // 2. 计算逻辑偏移量
  // 实际在循环中走过的“训练步数” = 总天数 - 额外休息天数
  const logicSteps = daysDiff - adjustments.count;
  
  // 3. 计算在循环中的位置 (假设循环总长度为 cycleLength = splitDays + restDays)
  const indexInCycle = logicSteps % cycleLength;
  
  // 4. 判断 indexInCycle 对应的是训练日还是固定休息日
  return cycleDefinition[indexInCycle]; 
}
```

---

## 7. 查缺补漏
- **动作删除逻辑**: 如果用户删除了动作库里的某个动作，但该动作在历史记录或当前计划中存在，应使用“软删除”或提示无法删除。
- **多计划支持**: 虽然目前需求是单计划，但数据库设计预留了 `plan_id`，未来可以扩展“增肌计划”、“减脂计划”等多个切换。
- **数据一致性**: 在修改“开始日期”时，需要清除之前的 `schedule_adjustments` 记录，否则逻辑偏移量会出错。建议在重置日期时给用户明确提示。
