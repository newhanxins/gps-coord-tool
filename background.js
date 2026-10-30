// 注意：配置了 default_popup 后，onClicked 事件不会触发
// 点击扩展图标会直接显示 popup.html
// 如果需要监听点击事件，需要移除 manifest.json 中的 default_popup 配置

chrome.action.onClicked.addListener(() => {
    const url = chrome.runtime.getURL('main.html');
    chrome.tabs.create({ url: url });
});
