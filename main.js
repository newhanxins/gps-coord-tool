// ==================== 配置 ====================
const POINT_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#F7DC6F', '#BB8FCE'];
let map, markers = [], longPressMarkers = [];
let parsedPoints = [];
let singlePoints = [];
let currentTab = 'single';
let currentMapType = 'gcj02';
let currentLayerType = 'street';
let baseLayers = {};
let layerControl;
const enableLongPressGps = true;

// ==================== 坐标转换算法 ====================
const pi = 3.1415926535897932384626;
const a = 6378245.0;
const ee = 0.00669342162296594323;

// 判断坐标是否在中国大陆范围内
function outOfChina(lng, lat) {
    return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

// 纬度转换函数（用于 WGS-84 到 GCJ-02 的偏移计算）
function transformLat(lng, lat) {
    let ret = -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
    ret += (20.0 * Math.sin(6.0 * lng * Math.PI) + 20.0 * Math.sin(2.0 * lng * Math.PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(lat * Math.PI) + 40.0 * Math.sin(lat / 3.0 * Math.PI)) * 2.0 / 3.0;
    ret += (160.0 * Math.sin(lat / 12.0 * Math.PI) + 320 * Math.sin(lat * Math.PI / 30.0)) * 2.0 / 3.0;
    return ret;
}

// 经度转换函数（用于 WGS-84 到 GCJ-02 的偏移计算）
function transformLng(lng, lat) {
    let ret = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
    ret += (20.0 * Math.sin(6.0 * lng * Math.PI) + 20.0 * Math.sin(2.0 * lng * Math.PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(lng * Math.PI) + 40.0 * Math.sin(lng / 3.0 * Math.PI)) * 2.0 / 3.0;
    ret += (150.0 * Math.sin(lng / 12.0 * Math.PI) + 300.0 * Math.sin(lng / 30.0 * Math.PI)) * 2.0 / 3.0;
    return ret;
}

// WGS-84 坐标转换为 GCJ-02 坐标（国测局加密）
function wgs84ToGcj02(lng, lat) {
    if (outOfChina(lng, lat)) return { lng, lat };
    let dlat = transformLat(lng - 105.0, lat - 35.0);
    let dlng = transformLng(lng - 105.0, lat - 35.0);
    const radlat = lat / 180.0 * pi;
    let magic = Math.sin(radlat);
    magic = 1 - ee * magic * magic;
    const sqrtmagic = Math.sqrt(magic);
    dlat = (dlat * 180.0) / ((a * (1 - ee)) / (magic * sqrtmagic) * pi);
    dlng = (dlng * 180.0) / (a / sqrtmagic * Math.cos(radlat) * pi);
    return { lng: lng + dlng, lat: lat + dlat };
}

// GCJ-02 坐标转换为 WGS-84 坐标（迭代逼近法）
function gcj02ToWgs84(lng, lat) {
    if (outOfChina(lng, lat)) return { lng, lat };
    let wgsLng = lng, wgsLat = lat;
    for (let i = 0; i < 10; i++) {
        const gcj = wgs84ToGcj02(wgsLng, wgsLat);
        const dLng = gcj.lng - lng;
        const dLat = gcj.lat - lat;
        wgsLng -= dLng;
        wgsLat -= dLat;
        if (Math.abs(dLng) < 1e-10 && Math.abs(dLat) < 1e-10) break;
    }
    return { lng: wgsLng, lat: wgsLat };
}

// GCJ-02 坐标转换为 BD-09 坐标（百度加密）
function gcj02ToBd09(lng, lat) {
    const z = Math.sqrt(lng * lng + lat * lat) + 0.00002 * Math.sin(lat * pi * 3000 / 180);
    const theta = Math.atan2(lat, lng) + 0.000003 * Math.cos(lng * pi * 3000 / 180);
    return { lng: z * Math.cos(theta) + 0.0065, lat: z * Math.sin(theta) + 0.006 };
}

// BD-09 坐标转换为 GCJ-02 坐标（百度逆向解密）
function bd09ToGcj02(lng, lat) {
    const x = lng - 0.0065;
    const y = lat - 0.006;
    const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * pi * 3000 / 180);
    const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * pi * 3000 / 180);
    return { lng: z * Math.cos(theta), lat: z * Math.sin(theta) };
}

// WGS-84 坐标直接转换为 BD-09 坐标（通过 GCJ-02 中转）
function wgs84ToBd09(lng, lat) {
    const gcj = wgs84ToGcj02(lng, lat);
    return gcj02ToBd09(gcj.lng, gcj.lat);
}

// BD-09 坐标直接转换为 WGS-84 坐标（通过 GCJ-02 中转）
function bd09ToWgs84(lng, lat) {
    const gcj = bd09ToGcj02(lng, lat);
    return gcj02ToWgs84(gcj.lng, gcj.lat);
}

// 将任意坐标系转换为三种坐标系（WGS-84、GCJ-02、BD-09）
function convertAll(lng, lat, fromType) {
    let wgs84, gcj02, bd09;
    if (fromType === 'wgs84') {
        wgs84 = { lng, lat };
        gcj02 = wgs84ToGcj02(lng, lat);
        bd09 = gcj02ToBd09(gcj02.lng, gcj02.lat);
    } else if (fromType === 'gcj02') {
        gcj02 = { lng, lat };
        wgs84 = gcj02ToWgs84(lng, lat);
        bd09 = gcj02ToBd09(lng, lat);
    } else if (fromType === 'bd09') {
        bd09 = { lng, lat };
        const gcj = bd09ToGcj02(lng, lat);
        gcj02 = gcj;
        wgs84 = gcj02ToWgs84(gcj.lng, gcj.lat);
    }
    return { wgs84, gcj02, bd09 };
}

// 将输入坐标转换为当前地图坐标系
function convertToMapCoords(lng, lat, inputType) {
    const enableOffset = document.getElementById('offsetSwitch').checked;

    // 未勾选坐标偏移计算，或输入类型与地图类型相同，直接返回原始坐标
    if (!enableOffset || inputType === currentMapType) {
        return { lng, lat };
    }

    // 1. 输入坐标 -> WGS-84
    let wgs84;
    if (inputType === 'wgs84') {
        wgs84 = { lng, lat };
    } else if (inputType === 'gcj02') {
        wgs84 = gcj02ToWgs84(lng, lat);
    } else if (inputType === 'bd09') {
        wgs84 = bd09ToWgs84(lng, lat);
    }

    // 2. WGS-84 -> 地图坐标系
    if (currentMapType === 'wgs84' || currentMapType === 'google') {
        return wgs84;
    } else if (currentMapType === 'gcj02') {
        return wgs84ToGcj02(wgs84.lng, wgs84.lat);
    } else if (currentMapType === 'bd09') {
        // 百度地图使用高德瓦片作为底图，需要将坐标转为 GCJ-02 以匹配高德瓦片
        return wgs84ToGcj02(wgs84.lng, wgs84.lat);
    }
}

// ==================== 初始化 ====================
// 页面初始化入口：初始化地图、单点输入和事件绑定
function init() {
    initMap();
    initSinglePoints();
    bindEvents();
}

// 初始化地图：创建 Leaflet 地图实例，添加各地图瓦片图层和控件
function initMap() {
    map = L.map('map').setView([30.6573, 104.0648], 12);

    // 高德瓦片 (GCJ-02)
    const gaodeStreet = L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
        subdomains: ['1', '2', '3', '4'], attribution: '高德地图', maxZoom: 18
    });
    const gaodeSatellite = L.tileLayer('https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}', {
        subdomains: ['1', '2', '3', '4'], attribution: '高德地图', maxZoom: 18
    });

    // OpenStreetMap (WGS-84) - 支持故障自动切换
    const osmStreetSources = [
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',  // OSM 官方
        'https://tile.openstreetmap.de/{z}/{x}/{y}.png',   // 德国镜像
        'https://a.tile.openstreetmap.fr/{z}/{x}/{y}.png'  // 法国镜像
    ];
    
    let currentOsmSourceIndex = 0;
    const osmStreet = L.tileLayer(osmStreetSources[currentOsmSourceIndex], {
        attribution: 'OpenStreetMap', 
        maxZoom: 18
    });
    
    // OSM 瓦片加载失败时自动切换到下一个源
    osmStreet.on('tileerror', function(e) {
        const failedUrl = e.tile.src;
        const currentIndex = osmStreetSources.findIndex(url => failedUrl.includes(url.split('/')[2]));
        
        if (currentIndex === currentOsmSourceIndex && currentOsmSourceIndex < osmStreetSources.length - 1) {
            currentOsmSourceIndex++;
            console.log('OSM 加载失败，切换到备用源:', osmStreetSources[currentOsmSourceIndex]);
            osmStreet.setUrl(osmStreetSources[currentOsmSourceIndex]);
            showToast('OpenStreetMap 切换至备用源 ' + (currentOsmSourceIndex + 1));
        }
    });
    const osmSatellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Esri', maxZoom: 18
    });

    // Google Maps (WGS-84)
    const googleStreet = L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        subdomains: ['0', '1', '2', '3'], attribution: 'Google Maps', maxZoom: 20
    });
    const googleSatellite = L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        subdomains: ['0', '1', '2', '3'], attribution: 'Google Maps', maxZoom: 20
    });

    // 百度地图使用高德瓦片作为底图（百度瓦片需百度墨卡托投影，Leaflet 直接加载不稳定）
    const baiduStreet = L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
        subdomains: ['1', '2', '3', '4'], attribution: '百度坐标系 (高德底图)', maxZoom: 18
    });
    const baiduSatellite = L.tileLayer('https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}', {
        subdomains: ['1', '2', '3', '4'], attribution: '百度坐标系 (高德底图)', maxZoom: 18
    });

    baseLayers = {
        gcj02: {
            street: gaodeStreet,
            satellite: gaodeSatellite,
            name: '高德地图'
        },
        wgs84: {
            street: osmStreet,
            satellite: osmSatellite,
            name: 'OpenStreetMap'
        },
        google: {
            street: googleStreet,
            satellite: googleSatellite,
            name: 'Google Maps'
        },
        bd09: {
            street: baiduStreet,
            satellite: baiduSatellite,
            name: '百度地图'
        }
    };

    // 默认使用高德街道图
    gaodeStreet.addTo(map);

    // 添加图层切换控件（默认展开）
    layerControl = L.control.layers({
        '街道图': gaodeStreet,
        '卫星图': gaodeSatellite
    }, null, { 
        position: 'topright',
        collapsed: false  // 默认展开，不折叠
    }).addTo(map);

    if (enableLongPressGps) initLongPressEvent();
}

// 切换地图类型：移除旧图层，加载新地图瓦片并更新图层控件
function switchMapType() {
    const newMapType = document.getElementById('mapType').value;
    if (newMapType === currentMapType) return;

    currentMapType = newMapType;

    // 移除所有瓦片图层
    map.eachLayer(function(layer) {
        if (layer instanceof L.TileLayer) {
            map.removeLayer(layer);
        }
    });

    // 移除旧的图层控件
    if (layerControl) {
        map.removeControl(layerControl);
    }

    // 移除旧的监听器
    map.off('baselayerchange', handleBaseLayerChange);

    const currentBase = baseLayers[currentMapType];

    // 添加当前图层类型
    currentBase[currentLayerType].addTo(map);

    // 添加图层切换控件（默认展开）
    const baseMaps = {
        '街道图': currentBase.street,
        '卫星图': currentBase.satellite
    };
    layerControl = L.control.layers(baseMaps, null, { 
        position: 'topright',
        collapsed: false  // 默认展开，不折叠
    }).addTo(map);

    // 监听图层切换
    map.on('baselayerchange', handleBaseLayerChange);

    // 重新加载标记
    updatePositions();
}

// 处理图层切换事件：当用户切换街道图/卫星图时更新当前图层类型
function handleBaseLayerChange(e) {
    const currentBase = baseLayers[currentMapType];
    if (e.layer === currentBase.street) {
        currentLayerType = 'street';
    } else if (e.layer === currentBase.satellite) {
        currentLayerType = 'satellite';
    }
}

// ==================== Tab 切换 ====================
// 切换单点输入/批量输入 Tab 页
function switchTab(tabName) {
    currentTab = tabName;
    document.querySelectorAll('.tab-nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === (tabName === 'single' ? 'tabSingle' : 'tabBatch'));
    });
    if (tabName === 'single') {
        parseSinglePoints();
    } else {
        parseBatchInput();
    }
}

// ==================== 单点输入 ====================
// 初始化单点输入：默认添加一个输入点
function initSinglePoints() {
    addSinglePoint();
}

// 添加新的单点输入项（自动分配 A、B、C... 标识）
function addSinglePoint() {
    const idx = singlePoints.length;
    const pointId = String.fromCharCode(65 + idx);
    singlePoints.push({ id: pointId, lng: '', lat: '' });
    renderSinglePoints();
}

// 删除指定的单点输入项（至少保留一个点）
function removeSinglePoint(index) {
    if (singlePoints.length <= 1) {
        showToast('至少保留一个点');
        return;
    }
    singlePoints.splice(index, 1);
    singlePoints.forEach((p, i) => { p.id = String.fromCharCode(65 + i); });
    renderSinglePoints();
    parseSinglePoints();
}

// 渲染单点输入区域的 HTML（动态生成输入框和删除按钮）
function renderSinglePoints() {
    const container = document.getElementById('pointInputs');
    let html = '';
    singlePoints.forEach((pt, idx) => {
        const color = POINT_COLORS[idx % POINT_COLORS.length];
        html += '<div class="point-input-item" data-index="' + idx + '">' +
            '<div class="point-header">' +
            '<span class="point-badge" style="background:' + color + '">' + pt.id + '</span>' +
            '<button class="btn-remove" data-remove="' + idx + '">删除</button>' +
            '</div>' +
            '<div class="point-row">' +
            '<div class="input-group">' +
            '<label>经度</label>' +
            '<input type="text" class="lng-input" data-index="' + idx + '" placeholder="104.0648" value="' + (pt.lng || '') + '">' +
            '</div>' +
            '<div class="input-group">' +
            '<label>纬度</label>' +
            '<input type="text" class="lat-input" data-index="' + idx + '" placeholder="30.6573" value="' + (pt.lat || '') + '">' +
            '</div>' +
            '</div>' +
            '</div>';
    });
    container.innerHTML = html;
}

// 解析单点输入区域的坐标值，验证格式并存储到 parsedPoints
function parseSinglePoints() {
    if (currentTab !== 'single') return;
    parsedPoints = [];
    const coordType = document.getElementById('coordType').value;
    singlePoints.forEach((pt, idx) => {
        const lngInput = document.querySelector('.lng-input[data-index="' + idx + '"]');
        const latInput = document.querySelector('.lat-input[data-index="' + idx + '"]');
        if (!lngInput || !latInput) return;
        const lng = parseFloat(lngInput.value.trim());
        const lat = parseFloat(latInput.value.trim());
        if (!isNaN(lng) && !isNaN(lat) && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90) {
            parsedPoints.push({ id: pt.id, lng, lat, coordType });
        }
    });
    updateConvertResult();
}

// 收集单点输入区域的当前值到 singlePoints 数组
function collectSinglePoints() {
    singlePoints.forEach((pt, idx) => {
        const lngInput = document.querySelector('.lng-input[data-index="' + idx + '"]');
        const latInput = document.querySelector('.lat-input[data-index="' + idx + '"]');
        if (lngInput && latInput) {
            pt.lng = lngInput.value.trim();
            pt.lat = latInput.value.trim();
        }
    });
}

// ==================== 批量输入 ====================
// 解析批量输入文本框中的坐标（每行格式：经度,纬度）
function parseBatchInput() {
    if (currentTab !== 'batch') return;
    const text = document.getElementById('batchInput').value.trim();
    parsedPoints = [];
    if (!text) { updateConvertResult(); return; }

    const lines = text.split(/[\r\n]+/).filter(line => line.trim());
    const coordType = document.getElementById('coordType').value;

    lines.forEach((line, idx) => {
        const parts = line.split(/[,，\s]+/).filter(p => p.trim());
        if (parts.length >= 2) {
            const lng = parseFloat(parts[0]);
            const lat = parseFloat(parts[1]);
            if (!isNaN(lng) && !isNaN(lat) && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90) {
                parsedPoints.push({ id: String.fromCharCode(65 + idx), lng, lat, coordType });
            }
        }
    });

    updateConvertResult();
}

// 坐标类型下拉框切换时触发，重新解析当前输入
function onCoordTypeChange() {
    if (currentTab === 'single') {
        parseSinglePoints();
    } else {
        parseBatchInput();
    }
}

// ==================== 长按功能 ====================
// 初始化地图长按事件：支持鼠标和触摸屏长按 800ms 触发定位
function initLongPressEvent() {
    let pressTimer;
    map.on('mousedown', (e) => {
        pressTimer = setTimeout(() => showLongPressPosition(e.latlng), 800);
    });
    map.on('mouseup', () => clearTimeout(pressTimer));
    map.on('mousemove', () => clearTimeout(pressTimer));
    map.on('touchstart', (e) => {
        if (e.originalEvent.touches.length === 1) {
            const touch = e.originalEvent.touches[0];
            pressTimer = setTimeout(() => {
                const latlng = map.containerPointToLatLng(L.point(touch.clientX, touch.clientY));
                showLongPressPosition(latlng);
            }, 800);
        }
    });
    map.on('touchend', () => clearTimeout(pressTimer));
}

// 显示长按位置的坐标信息：在地图上添加标记并显示弹窗
function showLongPressPosition(latlng) {
    const lng = latlng.lng, lat = latlng.lat;
    let coords, wgs84;
    const enableOffset = document.getElementById('offsetSwitch').checked;

    if (currentMapType === 'gcj02') {
        wgs84 = enableOffset ? gcj02ToWgs84(lng, lat) : { lng: lng, lat: lat };
        coords = { type: 'GCJ-02', lng: lng, lat: lat, wgs84: wgs84 };
    } else if (currentMapType === 'bd09') {
        // 百度地图使用高德瓦片，长按坐标是 GCJ-02
        wgs84 = enableOffset ? gcj02ToWgs84(lng, lat) : { lng: lng, lat: lat };
        const bd09 = enableOffset ? gcj02ToBd09(lng, lat) : { lng: lng, lat: lat };
        coords = { type: 'BD-09', lng: bd09.lng, lat: bd09.lat, wgs84: wgs84 };
    } else {
        wgs84 = { lng: lng, lat: lat };
        const typeName = currentMapType === 'google' ? 'Google Maps (WGS-84)' : 'WGS-84';
        coords = { type: typeName, lng: lng, lat: lat, wgs84: wgs84 };
    }

    longPressMarkers.forEach(m => map.removeLayer(m));
    longPressMarkers = [];
    const icon = L.divIcon({ html: '<div class="long-press-marker"></div>', className: '', iconSize: [20, 20], iconAnchor: [10, 10] });
    const marker = L.marker([lat, lng], { icon }).addTo(map).bindPopup(createLongPressPopup(coords)).openPopup();
    longPressMarkers.push(marker);
}

// 创建长按位置的弹窗 HTML：显示地图坐标和真实 GPS 坐标，以及偏移距离
function createLongPressPopup(coords) {
    const offset = Math.sqrt(Math.pow(coords.lng - coords.wgs84.lng, 2) + Math.pow(coords.lat - coords.wgs84.lat, 2)) * 100000;
    return '<div class="popup-title">当前位置坐标</div>' +
        '<div style="margin-bottom:6px; color:#1890ff; font-size:11px;">地图坐标 (' + coords.type + ')</div>' +
        '<div class="popup-row"><span class="popup-label">经度:</span><span class="popup-value">' + coords.lng.toFixed(6) + '</span></div>' +
        '<div class="popup-row"><span class="popup-label">纬度:</span><span class="popup-value">' + coords.lat.toFixed(6) + '</span></div>' +
        '<div style="margin:6px 0; border-top:1px dashed #ddd;"></div>' +
        '<div style="margin-bottom:6px; color:#52c41a; font-size:11px;">真实GPS (WGS-84)</div>' +
        '<div class="popup-row"><span class="popup-label">经度:</span><span class="popup-value">' + coords.wgs84.lng.toFixed(6) + '</span></div>' +
        '<div class="popup-row"><span class="popup-label">纬度:</span><span class="popup-value">' + coords.wgs84.lat.toFixed(6) + '</span></div>' +
        '<div style="margin-top:6px; padding:4px 6px; background:#f0f2f5; border-radius:4px; font-size:10px; color:#666;">偏移约 ' + offset.toFixed(1) + 'm</div>';
}

// ==================== 坐标转换结果展示 ====================
// 根据 parsedPoints 数组，生成左侧转换结果区域的 HTML
function updateConvertResult() {
    const body = document.getElementById('convertResultBody');
    if (parsedPoints.length === 0) {
        body.innerHTML = '<div class="convert-item"><span class="convert-item-label" style="color:#999;">请输入有效坐标</span></div>';
        return;
    }

    let html = '';
    parsedPoints.forEach((pt, idx) => {
        const results = convertAll(pt.lng, pt.lat, pt.coordType);
        const color = POINT_COLORS[idx % POINT_COLORS.length];
        const wgs84Str = results.wgs84.lng.toFixed(6) + ',' + results.wgs84.lat.toFixed(6);
        const gcj02Str = results.gcj02.lng.toFixed(6) + ',' + results.gcj02.lat.toFixed(6);
        const bd09Str = results.bd09.lng.toFixed(6) + ',' + results.bd09.lat.toFixed(6);
        html += '<div style="padding:8px 12px; border-bottom:1px solid #f0f0f0; background:' + color + '10;">' +
            '<div style="font-weight:600; font-size:12px; margin-bottom:6px; color:' + color + ';">点 ' + pt.id + '</div>' +
            '<div class="convert-item" style="padding:4px 0; border:none;">' +
            '<span class="convert-item-label">WGS-84:</span>' +
            '<span class="convert-item-value">' + wgs84Str + '</span>' +
            '<button class="btn-copy" data-coords="' + wgs84Str + '">复制</button>' +
            '</div>' +
            '<div class="convert-item" style="padding:4px 0; border:none;">' +
            '<span class="convert-item-label">GCJ-02:</span>' +
            '<span class="convert-item-value">' + gcj02Str + '</span>' +
            '<button class="btn-copy" data-coords="' + gcj02Str + '">复制</button>' +
            '</div>' +
            '<div class="convert-item" style="padding:4px 0; border:none;">' +
            '<span class="convert-item-label">BD-09:</span>' +
            '<span class="convert-item-value">' + bd09Str + '</span>' +
            '<button class="btn-copy" data-coords="' + bd09Str + '">复制</button>' +
            '</div>' +
            '</div>';
    });
    body.innerHTML = html;
}

// ==================== 更新位置 ====================
// 更新地图标记位置：解析输入坐标，转换并在地图上添加标记点
function updatePositions() {
    if (currentTab === 'single') {
        parseSinglePoints();
    } else {
        parseBatchInput();
    }

    markers.forEach(m => map.removeLayer(m));
    markers = [];

    if (parsedPoints.length === 0) {
        showToast('请输入有效的经纬度坐标');
        return;
    }

    const bounds = L.latLngBounds();

    parsedPoints.forEach((pt, idx) => {
        const results = convertAll(pt.lng, pt.lat, pt.coordType);

        // 根据当前地图类型进行坐标转换
        const mapCoords = convertToMapCoords(pt.lng, pt.lat, pt.coordType);

        const color = POINT_COLORS[idx % POINT_COLORS.length];
        const markerHtml = '<div class="custom-marker" style="background:' + color + '"><span>' + pt.id + '</span></div>';
        const icon = L.divIcon({ html: markerHtml, className: '', iconSize: [28, 28], iconAnchor: [14, 28] });
        const marker = L.marker([mapCoords.lat, mapCoords.lng], { icon }).addTo(map).bindPopup(createMarkerPopup(pt, results));
        markers.push(marker);
        bounds.extend([mapCoords.lat, mapCoords.lng]);
    });

    if (parsedPoints.length === 1) {
        map.setView([bounds.getCenter().lat, bounds.getCenter().lng], 15);
    } else {
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}

// 生成标记点的弹窗 HTML 内容
function createMarkerPopup(pt, results) {
    return '<div class="popup-title">点 ' + pt.id + '</div>' +
        '<div style="margin-bottom:4px; color:#1890ff; font-size:11px;">输入坐标 (' + getCoordTypeName(pt.coordType) + ')</div>' +
        '<div class="popup-row"><span class="popup-label">经度:</span><span class="popup-value">' + pt.lng.toFixed(6) + '</span></div>' +
        '<div class="popup-row"><span class="popup-label">纬度:</span><span class="popup-value">' + pt.lat.toFixed(6) + '</span></div>' +
        '<div style="margin:6px 0; border-top:1px dashed #ddd;"></div>' +
        '<div style="margin-bottom:4px; color:#52c41a; font-size:11px;">转换结果</div>' +
        '<div class="popup-row"><span class="popup-label">WGS-84:</span><span class="popup-value">' + results.wgs84.lng.toFixed(6) + ', ' + results.wgs84.lat.toFixed(6) + '</span></div>' +
        '<div class="popup-row"><span class="popup-label">GCJ-02:</span><span class="popup-value">' + results.gcj02.lng.toFixed(6) + ', ' + results.gcj02.lat.toFixed(6) + '</span></div>' +
        '<div class="popup-row"><span class="popup-label">BD-09:</span><span class="popup-value">' + results.bd09.lng.toFixed(6) + ', ' + results.bd09.lat.toFixed(6) + '</span></div>' +
        '<div style="margin-top:6px; text-align:center; font-size:11px; color:#999;">请在左侧复制坐标</div>';
}

// 获取坐标类型的中文显示名称
function getCoordTypeName(type) {
    const names = { wgs84: 'WGS-84', gcj02: 'GCJ-02', bd09: 'BD-09' };
    return names[type] || type;
}

// ==================== 复制功能 ====================
// 复制坐标文本到剪贴板（优先使用 Clipboard API，降级使用 execCommand）
async function copyCoords(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('已复制: ' + text);
    } catch (err) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed'; textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('已复制: ' + text);
    }
}

// 显示底部 Toast 提示信息（2秒后自动消失）
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}

// ==================== 事件绑定 ====================
// 绑定所有 UI 事件监听器：Tab 切换、输入框变化、按钮点击等
function bindEvents() {
    // Tab 切换
    document.querySelectorAll('.tab-nav-item').forEach(item => {
        item.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });

    // 坐标类型选择
    document.getElementById('coordType').addEventListener('change', onCoordTypeChange);

    // 地图类型选择
    document.getElementById('mapType').addEventListener('change', switchMapType);

    // 批量输入
    document.getElementById('batchInput').addEventListener('input', parseBatchInput);

    // 添加点按钮
    document.getElementById('addPointBtn').addEventListener('click', function() {
        collectSinglePoints();
        addSinglePoint();
    });

    // 单点输入区域事件委托
    document.getElementById('pointInputs').addEventListener('input', function(e) {
        if (e.target.classList.contains('lng-input') || e.target.classList.contains('lat-input')) {
            parseSinglePoints();
        }
    });

    // 删除按钮事件委托
    document.getElementById('pointInputs').addEventListener('click', function(e) {
        if (e.target.classList.contains('btn-remove')) {
            const index = parseInt(e.target.dataset.remove);
            collectSinglePoints();
            removeSinglePoint(index);
        }
    });

    // 坐标偏移计算开关
    document.getElementById('offsetSwitch').addEventListener('change', updatePositions);

    // 更新位置
    document.getElementById('updateBtn').addEventListener('click', updatePositions);

    // 复制按钮事件委托
    document.getElementById('convertResultBody').addEventListener('click', function(e) {
        if (e.target.classList.contains('btn-copy')) {
            const text = e.target.dataset.coords;
            if (text) copyCoords(text);
        }
    });
}

// 初始化
document.addEventListener('DOMContentLoaded', init);
