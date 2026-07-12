chrome.action.onClicked.addListener(() => {
    const url = chrome.runtime.getURL('main.html');
    chrome.tabs.create({ url: url });
});
