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

