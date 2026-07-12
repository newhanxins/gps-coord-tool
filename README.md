# GPS坐标定位工具（Chrome扩展）

基于 Chrome Extension Manifest V3 开发的 GPS坐标定位与地图可视化工具，支持 WGS-84 / GCJ-02 / BD-09 三种主流坐标系的输入、转换与地图定位。

## 功能特性

### 核心功能
- **多坐标系支持**：WGS-84（GPS原始坐标）、GCJ-02（高德/腾讯）、BD-09（百度）
- **坐标自动转换**：输入任意坐标系后自动转换为其他两种坐标系
- **批量点位定位**：支持单点输入和批量坐标输入（每行格式：`经度,纬度`）
- **地图可视化**：在地图上以不同颜色标记各点位，支持点击查看详情
- **坐标复制**：一键复制任意坐标系下的经纬度值

### 地图功能
- **多地图切换**：高德地图（GCJ-02）、百度地图（BD-09）、Google Maps（WGS-84）、OpenStreetMap（WGS-84）
- **图层切换**：支持街道图和卫星图切换
- **坐标偏移计算开关**：勾选后自动将输入坐标转换为当前地图坐标系；取消勾选则直接以原始坐标定位
- **长按定位**：在地图上长按可获取当前位置的坐标信息

## 技术栈

- **Chrome Extension Manifest V3**
- **Leaflet.js**：地图渲染引擎（本地引用，避免CSP限制）
- **纯原生 JavaScript**：无框架依赖，轻量高效

## 文件结构

```
gps-coord-tool/
├── manifest.json       # Chrome扩展配置文件（Manifest V3）
├── background.js       # 后台Service Worker，处理点击事件
├── popup.html          # 扩展弹出窗口界面
├── main.html           # 主界面（地图+坐标输入面板）
├── main.js             # 核心逻辑：坐标转换、地图交互、事件绑定
├── leaflet.js          # Leaflet地图库（本地）
├── leaflet.css         # Leaflet样式文件（本地）
└── icon.png            # 扩展图标
```

## 坐标转换算法说明

### WGS-84 ↔ GCJ-02
- **WGS-84 → GCJ-02**：使用国测局加密算法，基于参考椭球和区域偏移函数进行转换
- **GCJ-02 → WGS-84**：采用迭代逼近法，逐步修正偏移量

### GCJ-02 ↔ BD-09
- **GCJ-02 → BD-09**：极坐标偏移算法，加入二次加密
- **BD-09 → GCJ-02**：逆向极坐标解密

### WGS-84 ↔ BD-09
- 通过 GCJ-02 作为中间桥梁：`WGS-84 ↔ GCJ-02 ↔ BD-09`

## 安装与使用

### 安装扩展
1. 打开 Chrome 浏览器，进入 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」，选择本项目目录 `gps-coord-tool/`
4. 扩展安装完成，点击工具栏图标即可使用

### 使用流程
1. **选择输入坐标类型**：在左侧面板选择输入坐标的坐标系（WGS-84/GCJ-02/BD-09）
2. **选择地图类型**：选择需要定位的地图（高德/百度/Google/OSM）
3. **输入坐标**：
   - 单点模式：输入经纬度后点击「添加点」按钮自动递增（A、B、C...）
   - 批量模式：每行输入 `经度,纬度`，支持多行
4. **点击「更新位置」**：在地图上显示标记点
5. **查看转换结果**：左侧自动显示三种坐标系的转换结果，点击「复制」即可复制

### 坐标偏移计算开关
- **勾选（默认）**：输入坐标自动转换为当前地图坐标系，标记精确对准地图位置
- **取消勾选**：直接以原始输入坐标定位，可用于观察不同坐标系之间的偏移差异

## 注意事项

### 坐标系差异说明
- **WGS-84**：GPS设备输出的原始坐标，国际通用
- **GCJ-02**：中国国测局加密坐标，高德地图、腾讯地图、Google Maps（中国区域）使用
- **BD-09**：百度加密坐标，在GCJ-02基础上再次加密

### 地图坐标系对应关系
| 地图类型 | 瓦片坐标系 | 标记坐标处理 |
|---------|-----------|------------|
| 高德地图 | GCJ-02 | 输入坐标 → GCJ-02 |
| 百度地图 | GCJ-02（高德底图） | 输入坐标 → GCJ-02（底图匹配），显示BD-09坐标 |
| Google Maps | WGS-84 | 输入坐标 → WGS-84 |
| OpenStreetMap | WGS-84 | 输入坐标 → WGS-84 |

> 注：百度地图瓦片需百度墨卡托投影支持，Leaflet直接加载不稳定，当前采用高德瓦片作为底图，通过坐标转换保证标记位置精确。

## Chrome扩展配置（Manifest V3）

```json
{
    "manifest_version": 3,
    "name": "GPS坐标定位工具",
    "version": "1.0.0",
    "description": "支持WGS-84/GCJ-02/BD-09多种坐标系转换和地图定位",
    "permissions": ["tabs"],
    "background": { "service_worker": "background.js" },
    "action": { "default_icon": { ... } },
    "icons": { ... },
    "web_accessible_resources": [
        { "resources": ["main.html", "icon.png"], "matches": ["<all_urls>"] }
    ]
}
```

### 关键配置说明
- **`permissions: ["tabs"]`**：允许扩展创建新标签页打开 `main.html`
- **`service_worker`**：Manifest V3 的后台脚本（替代 V2 的 background script）
- **`web_accessible_resources`**：使 `main.html` 可通过 `chrome.runtime.getURL()` 访问

## 开发说明

### 本地调试
1. 修改代码后，在 `chrome://extensions/` 页面点击扩展卡片上的刷新按钮
2. 重新点击扩展图标即可看到更新效果

### 技术限制
- **CSP 限制**：Chrome 扩展默认禁止内联脚本和外部 CDN 引用，所有 JavaScript 必须放在外部文件中
- **本地资源**：Leaflet.js 和 Leaflet.css 已下载到本地，避免外部引用被 CSP 拦截
- **坐标精度**：坐标转换算法基于近似公式，精度约 1-5 米，适用于一般定位场景
