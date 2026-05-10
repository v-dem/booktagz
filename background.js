import Repository from './scripts/Repository.js';

async function getCurrentActiveTab() {
    let queryOptions = { active: true, lastFocusedWindow: true };
    let [ tab ] = await chrome.tabs.query(queryOptions);

    return tab;
}

const repository = new Repository();

chrome.bookmarks.onCreated.addListener((id, bookmark) => {
    console.log("Bookmark created!");
    console.log("ID:", id);
    console.log("Bookmark object:", bookmark);

    // You can now perform actions based on the new bookmark
    // For example, you could send a message to a content script,
    // store information in local storage, or modify the bookmark.

    // chrome.action.openPopup();

    setTimeout(() => {
        // chrome.runtime.sendMessage({ type: 'booktagz-addBookmark', data: bookmark });

        getCurrentActiveTab().then((tab) => {
            if (tab) {
                // TODO: Add new bookmark

                updateIcon(tab.id, bookmark.url);
            }
        });
    }, 0);
});


const ICONS_DEFAULT = {
    '128': 'assets/icons/icon128x128.png'
};

const ICONS_ACTIVE = {
    '128': 'assets/icons/icon128x128-active.png'
};

function updateIcon(tabId, url) {
    if (url && !url.match(/^chrome:/)) {
        repository.loadBookmark(url).then((bookmark) => {
            if (bookmark) {
                // Change icon to 'active'
                chrome.action.setIcon({
                    path: ICONS_ACTIVE,
                    tabId: tabId
                });
            } else {
                // Revert to 'default' icon
                chrome.action.setIcon({
                    path: ICONS_DEFAULT,
                    tabId: tabId
                });
            }
        });
    } else {
        // Revert to 'default' icon
        chrome.action.setIcon({
            path: ICONS_DEFAULT,
            tabId: tabId
        });
    }
}

// Listen for tab updates (e.g., URL change within the same tab)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.url) {
        console.log('chrome.tabs.onUpdated', tabId, changeInfo, tab);
        updateIcon(tabId, tab.url);
    }
});

// Listen for tab switching (e.g., changing active tab in a window)
chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        console.log('chrome.tabs.onActivated', activeInfo);
        updateIcon(activeInfo.tabId, tab.url);
    });
});

// Listen for page reload
chrome.webNavigation.onCommitted.addListener((details) => {
    if (details.transitionType === 'reload') {
        console.log('chrome.webNavigation.onCommitted', details);
        updateIcon(details.tabId, details.url);
    }
});

