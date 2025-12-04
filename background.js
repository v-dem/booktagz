/*
chrome.bookmarks.onCreated.addListener((id, bookmark) => {
    console.log("Bookmark created!");
    console.log("ID:", id);
    console.log("Bookmark object:", bookmark);

    // You can now perform actions based on the new bookmark
    // For example, you could send a message to a content script,
    // store information in local storage, or modify the bookmark.

    chrome.action.openPopup();

    setTimeout(() => {
        chrome.runtime.sendMessage({ type: 'popupData', data: bookmark });
    }, 100);
});
*/

const ICONS_DEFAULT = {
    '128': 'assets/icons/icon128x128.png'
};

const ICONS_ACTIVE = {
    '128': 'assets/icons/icon128x128-active.png'
};

function updateIcon(tabId, url) {
    if (url && !url.match(/^chrome:/)) {
        console.log('checkpoint 1', url);
        const request = indexedDB.open('booktagzDb', 1);
        request.onsuccess = function(e) {
            const db = e.target.result;
            const transaction = db.transaction([ 'bookmarks' ], 'readonly');
            const store = transaction.objectStore('bookmarks');
            store.get(url).onsuccess = (e) => {
                console.log('checkpoint 2', e.target.result);
                if (e.target.result) {
                    // Change to 'active' icon for example.com
                    chrome.action.setIcon({
                        path: ICONS_ACTIVE,
                        tabId: tabId
                    });
                }
            };
            store.get(url).onerror = (e) => {
                chrome.action.setIcon({
                    path: ICONS_DEFAULT,
                    tabId: tabId
                });
            }
        }
    } else {
        // Revert to 'default' icon for other URLs
        chrome.action.setIcon({
            path: ICONS_DEFAULT,
            tabId: tabId
        });
    }
}

// Listen for tab updates (e.g., URL change within the same tab)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        updateIcon(tabId, changeInfo.url);
    }
});

// Listen for tab switching (e.g., changing active tab in a window)
chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        updateIcon(activeInfo.tabId, tab.url);
    });
});

