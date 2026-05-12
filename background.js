import Repository from './scripts/Repository.js';

const ICONS_DEFAULT = {
    '128': 'assets/icons/icon128x128.png'
};

const ICONS_ACTIVE = {
    '128': 'assets/icons/icon128x128-active.png'
};

async function getCurrentActiveTab() {
    let queryOptions = { active: true, lastFocusedWindow: true };
    let [ tab ] = await chrome.tabs.query(queryOptions);

    return tab;
}

const repository = new Repository(() => {
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

    function updateIcon(tabId, url) {
        // Needed to solve "Unchecked runtime.lastError: No tab with id" issue
        function updateCallback() {
            if (chrome.runtime.lastError) {
                // Ignore
            }
        }

        if (url && !url.match(/^chrome:/)) {
            repository.loadBookmark(url).then((bookmark) => {
                if (bookmark) {
                    // Change icon to 'active'
                    chrome.action.setIcon({
                        path: ICONS_ACTIVE,
                        tabId: tabId
                    }, updateCallback);
                } else {
                    // Revert to 'default' icon
                    chrome.action.setIcon({
                        path: ICONS_DEFAULT,
                        tabId: tabId
                    }, updateCallback);
                }
            });
        } else {
            // Revert to 'default' icon
            chrome.action.setIcon({
                path: ICONS_DEFAULT,
                tabId: tabId
            }, updateCallback);
        }
    }

    // Listen for tab updates (e.g., URL change within the same tab)
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (!tab.url) {
            return;
        }

    updateIcon(tabId, tab.url);
    });

    // Listen for tab switching (e.g., changing active tab in a window)
    chrome.tabs.onActivated.addListener((activeInfo) => {
        chrome.tabs.get(activeInfo.tabId, (tab) => {
            updateIcon(activeInfo.tabId, tab.url);
        });
    });

    // Listen for page reload
    chrome.webNavigation.onCommitted.addListener((details) => {
        if (details.transitionType === 'reload') {
            updateIcon(details.tabId, details.url);
        }
    });
});

