// popup.js - popup 页面的脚本
document.addEventListener('DOMContentLoaded', function() {
    const openBtn = document.getElementById('openBtn');
    const debugEl = document.getElementById('debug');
    
    if (!openBtn) {
        console.error('未找到打开工具按钮');
        return;
    }
    
    openBtn.addEventListener('click', function() {
        try {
            const url = chrome.runtime.getURL('main.html');
            console.log('准备打开:', url);
            
            if (debugEl) {
                debugEl.textContent = '正在打开: ' + url;
            }
            
            chrome.tabs.create({ url: url }, function(tab) {
                if (chrome.runtime.lastError) {
                    const errorMsg = chrome.runtime.lastError.message;
                    console.error('打开标签页失败:', errorMsg);
                    if (debugEl) {
                        debugEl.textContent = '错误: ' + errorMsg;
                        debugEl.style.color = '#ff4d4f';
                    }
                } else {
                    console.log('成功打开新标签页:', tab);
                    if (debugEl) {
                        debugEl.textContent = '已打开新标签页';
                        debugEl.style.color = '#52c41a';
                    }
                    // 延迟关闭 popup，让用户看到成功信息
                    setTimeout(function() {
                        window.close();
                    }, 500);
                }
            });
        } catch (err) {
            console.error('按钮点击异常:', err);
            if (debugEl) {
                debugEl.textContent = '异常: ' + err.message;
                debugEl.style.color = '#ff4d4f';
            }
        }
    });
    
    console.log('popup.js 已加载，按钮事件已绑定');
});
