/*
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.type === 'popupData') {
        console.log('Data received:', request.data);
    }
});
*/

class BookmarkTagElement extends HTMLElement {
    constructor(tag) {
        super();

        const templateContent = document.getElementById('bookmarkTagTemplate').content.cloneNode(true);
        this.appendChild(templateContent);
        this.querySelector('.bz-tag-name').textContent = tag;
    }

    connectedCallback () {
        console.log('Connected!')

        this.addEventListener('click', event => {
            const { target } = event 
        })
    }
}

customElements.define('bookmark-tag', BookmarkTagElement);

(async() => { // Load page data manually
    const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab) {
        console.log('booktagZ: URL: ', tab.url);
        if (tab.url.match(/^chrome:/)) {
            window.close();

            return;
        }

        document.querySelector('#inputUrl').value = tab.url;

        const activeTabId = tab.id;

        chrome.scripting.executeScript({
                target: { tabId: activeTabId },
                function: () => {
                    return {
                        title: document.title,
                        text: document.documentElement.innerText
                    };
                }
            },

            (results) => {
                if (results && results.length > 0) {
                    const pageTitle = results[0].result.title;
                    document.querySelector('#inputTitle').value = pageTitle;

                    const pageText = results[0].result.text + ' ' + pageTitle;

                    const words = pageText.replace(/[`~!@#$%^&*()|+=?;:…"«»„“—,<>\{\}\[\]\\\/]/gi, '').replace(/\s+/g, ' ').replace(/\n/g, ' ').split(' ');

                    const wordsHash = {};
                    words.forEach(word => {
                        // Apply some basic filtering
                        if (word.match(/^[.0-9_\-]+$/) && !word.match(/^\.[a-z]/i)) {
                            return;
                        }

                        word = word.replace(/\.+$/, '');

                        if (wordsHash[word]) {
                            wordsHash[word] = wordsHash[word] + 1;
                        } else {
                            wordsHash[word] = 1;
                        }
                    });

                    // Filter too short words (except abbreviations)
                    const wordCountsArray = [];
                    words.forEach(word => {
                        if (wordsHash[word] && (word.length > 1) && ((word.length > 3) || (word === word.toUpperCase()))) {
                            wordCountsArray.push({
                                'word': word,
                                'count': wordsHash[word]
                            });

                            delete wordsHash[word];
                        }
                    });

                    // Make words lowercase & combine same words
                    const wordsReducedHash = {};
                    wordCountsArray.forEach((word) => {
                        const wordLower = word.word.toLowerCase();
                        if (typeof wordsReducedHash[wordLower] === 'undefined') {
                            word.word = wordLower;
                            wordsReducedHash[wordLower] = word;
                        } else {
                            wordsReducedHash[wordLower].count += word.count;
                        }
                    });

                    const wordsReducedArray = Object.values(wordsReducedHash);

                    wordsReducedArray.sort(function(a, b) {
                        if (a.count < b.count) {
                            return -1;
                        }

                        if (a.count > b.count) {
                            return 1;
                        }

                        return 0;
                    });

                    console.log(wordsReducedArray);

                    // If there are ANY words already in user tags then display them first

                    const selectedWords = wordsReducedArray.slice(wordsReducedArray.length - 10).reverse();
                    selectedWords.forEach((word) => {
                        document.querySelector('#suggestedTagsPane').appendChild(new BookmarkTagElement(word.word));
                    });
                }
            }
        );
    }
})();

const accordions = document.querySelectorAll(".accordion-collapse");
let opening = false;
accordions.forEach(function (el) {
    el.addEventListener("hide.bs.collapse", (event) => {
        if (!opening) {
            event.preventDefault();
            event.stopPropagation();
        } else {
            opening = false;
        }
    });

    el.addEventListener("show.bs.collapse", (event) => {
        opening = true;
    });
});

document.querySelector('#importBookmarksAction').addEventListener('click', function() {
    chrome.bookmarks.getTree(function(bookmarks) {
        console.log("All bookmarks:", bookmarks);
    });
});

