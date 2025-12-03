import Tags from './node_modules/bootstrap5-tags/tags.min.js';

/*
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.type === 'popupData') {
        console.log('Data received:', request.data);
    }
});
*/

function loadRecords(db, store, keys, callback, transaction = null) {
    if (!transaction) {
        transaction = db.transaction([ store ], 'readonly');
    }

    const objectStore = transaction.objectStore(store);

    const results = {};
    Promise.all(keys.map(key => {
        return new Promise((resolve, reject) => {
            const request = objectStore.get(key);
            request.onsuccess = (event) => {
                results[key] = event.target.result;
                resolve();
            };
            request.onerror = (event) => {
                console.error('Error fetching record:', event.target.error);
                reject(event.target.error);
            };
        });
    }))
    .then(() => {
        callback(results);
    });
}

class Bookmark {
    constructor(url, title, tags = []) {
        this.url = url;
        this.title = title;
        this.tags = tags;
    }
}

class Tag {
    constructor(name, urls = []) {
        this.name = name;
        this.urls = urls;
    }
}

let db = null;

const request = window.indexedDB.open('booktagzDb', 1);
request.onerror = function(e) {
    console.error('Why didn\'t you allow my web app to use IndexedDB?!');
    console.log(e);
}
request.onsuccess = function(e) {
    db = {
        idb: e.target.result,

        loadTagsSet: function(tags, callback, transaction = null) {
            loadRecords(this.idb, 'tags', tags, callback, transaction);
        },

        loadBookmarksSet: function(urls, callback, transaction = null) {
            loadRecords(this.idb, 'bookmarks', urls, callback, transaction);
        },

        addUrl: function(url, title, tags) {
            return new Promise((resolve, reject) => {
                // 1. Check all tags, if not exist create and add this url, if exist append this url
                const transaction = this.idb.transaction([ 'tags', 'bookmarks', 'totals' ], 'readwrite');

                transaction.oncomplete = function() {
                    resolve(1);
                };
                transaction.onerror = (e) => {
                    reject(`addUrl error: ${e.target.error?.message}`);
                };

                this.loadTagsSet(tags, (existingTags) => {
                    const tagsStore = transaction.objectStore('tags');
                    tags.forEach(tag => {
                        if (typeof existingTags[tag] === 'undefined') {
                            tagsStore.add({
                                name: tag,
                                urls: [ url ]
                            });
                        } else {
                            existingTags[tag].urls.push(url);

                            tagsStore.put(existingTags[tag]);
                        }
                    });

                    // 2. Create a bookmark
                    const bookmarksStore = transaction.objectStore('bookmarks');
                    bookmarksStore.get(url).onsuccess = (e) => {
                        if (!e.target.result) {
                            bookmarksStore.add({
                                url: url,
                                title: title,
                                tags: tags
                            });
                        }
                    };

                    // 3. Update totals
                    const totalsStore = transaction.objectStore('totals');
                    totalsStore.get(1).onsuccess = (e) => {
                        const tagsObject = e.target.result;
                        const newTags = new Set([ ...tagsObject.tags, ...tags ]);
                        tagsObject.tags = [ ...newTags ];
                        tagsObject.recent = [ ...tagsObject.recent, ...newTags ];
                        if (tagsObject.recent.length > 10) {
                            tagsObject.recent = tagsObject.recent.slice(-10);
                        }

                        totalsStore.put(tagsObject, 1);
                    };
                }, transaction);
            });
        },

        getTotals: function() {
            return new Promise((resolve, reject) => {
                const transaction = this.idb.transaction([ 'totals' ], 'readonly');
                const store = transaction.objectStore('totals');
                store.get(1).onsuccess = (e) => {
                    resolve(e.target.result);
                };

                transaction.onerror = (e) => {
                    reject(`getTotals error: ${e.target.error?.message}`);
                };
            });
        },

        loadMostUsed: function() {
            const transaction = this.idb.transaction([ 'tags' ], 'readonly');
            const store = transaction.objectStore('tags');
            store.getAll().onsuccess = (e) => {
                const mostUsed = e.target.result;
                mostUsed.sort(function(a, b) {
                    if (a.urls.length < b.urls.length) {
                        return -1;
                    }

                    if (a.urls.length > b.urls.length) {
                        return 1;
                    }

                    return 0;
                });

                mostUsed.slice(-10).reverse().forEach((tag) => {
                    const word = {
                        word:           tag.name,
                        isHighlighted:  true
                    };

                    document.querySelector('#mostUsedTagsPane').appendChild(new BookmarkTagElement(word));
                });
            };
        },

        loadTopBookmarks: function(tags = [], callback) {
            if (tags.length) {
                this.loadTagsSet(tags, (tagRecords) => {
                    console.log(tagRecords);

                    // TODO: Filter all urls for all tags
                });
            } else {
                const transaction = this.idb.transaction([ 'bookmarks' ], 'readonly');
                const store = transaction.objectStore('bookmarks');
                store.getAll({
                    count: 10,
                    direction: 'next'
                }).onsuccess = (e) => {
                    console.log(e.target.result);

                    callback(e.target.result);
                };
            }
        }
    }

    e.target.result.onerror = (e) => {
        console.error(`Database error: ${e.target.error?.message}`);
    };

    db.getTotals().then((totals) => {
        Tags.init('#inputTags', {
            'suggestionsThreshold': 1,
            'allowNew':             true,
            'allowClear':           true,
            'clearEnd':             true,
            'startsWith':           true,
            'addOnBlur':            true,
            'searchLabel':          'Select or type in tags...',
            'placeholder':          'Select or type in tags...',

            'items': totals.tags.reduce((obj, item, index) => {
                obj[item] = item;
                return obj;
            }, {}),

            'onCreateItem': (item, a, b) => {
                if (item.dataset.value) {
                    tagsManager.check(item.dataset.value, false);
                }
            },

            'onSelectItem': (item, a, b) => {
                tagsManager.check(item.value, false);
            },

            'onClearItem': (item, a, b) => {
                tagsManager.uncheck(item);
            }
        });

        Tags.init('#searchTags', {
            'suggestionsThreshold': 1,
            'allowClear':           true,
            'clearEnd':             true,
            'startsWith':           true,
            'addOnBlur':            true,
            'searchLabel':          'Select or type in tags...',
            'placeholder':          'Select or type in tags...',

            'items': totals.tags.reduce((obj, item, index) => {
                obj[item] = item;
                return obj;
            }, {}),

            'onSelectItem': (item, a, b) => {
                // tagsManager.check(item.value, false);
            },

            'onClearItem': (item, a, b) => {
                // tagsManager.uncheck(item);
            }
        });

        totals.recent.forEach((tag) => {
            const word = {
                word:           tag,
                isHighlighted:  true
            };

            document.querySelector('#recentTagsPane').appendChild(new BookmarkTagElement(word));
        });
    });

    loadAndParsePage();

    db.loadMostUsed();

    db.loadTopBookmarks([], (bookmarks) => {
        document.querySelector('#bookmarksFound').innerHTML = '';

        bookmarks.forEach((bookmark) => {
            const templateContent = document.querySelector('#bookmarkRowTemplate').content.cloneNode(true);

            templateContent.querySelector('tr').dataset['url'] = bookmark.url;
            templateContent.querySelector('tr').title = bookmark.url;
            templateContent.querySelector('.bookmark-name').textContent = bookmark.title;
            templateContent.querySelector('.bookmark-link').href = bookmark.url;

            document.querySelector('#bookmarksFound').appendChild(templateContent);
        });
    });
}
request.onupgradeneeded = (event) => {
    // Database schema:
    // - bookmarks (url (unique), title, tags[])
    // - tags (name (unique), urls[])
    // - totals (1, tags[])

    const db = event.target.result;

    db.createObjectStore('bookmarks', { keyPath: 'url' });

    db.createObjectStore('tags', { keyPath: 'name' });

    const totalsStore = db.createObjectStore('totals', { autoIncrement: true });
    totalsStore.add({
        tags: [],
        recent: []
    });
};

const tagsManager = {
    elements: [],

    add: function(element) {
        this.elements.push(element);
    },

    check: function(tag, shouldAddItem = true) {
        this.elements.forEach((element) => {
            if (element.dataset['tag'] === tag) {
                element.querySelector('button').classList.add('active');
                element.querySelector('button').ariaPressed = true;
            }
        });

        if (shouldAddItem) {
            const inputTags = Tags.getInstance(document.querySelector('#inputTags'));
            inputTags.addItem(tag, tag);
            inputTags.s.placeholder = '';
        }
    },

    uncheck: function(tag) {
        this.elements.forEach((element) => {
            if (element.dataset['tag'] === tag) {
                element.querySelector('button').classList.remove('active');
                element.querySelector('button').ariaPressed = false;
            }
        });

        const inputTags = Tags.getInstance(document.querySelector('#inputTags'));
        inputTags.removeItem(tag);
        if (inputTags.getSelectedValues().length === 0) {
            inputTags.s.placeholder = 'Select or type in tags...';
        }
    }
}

class BookmarkTagElement extends HTMLElement {
    constructor(tag) {
        super();

        const templateContent = document.querySelector('#bookmarkTagTemplate').content.cloneNode(true);
        this.appendChild(templateContent);
        this.dataset['tag'] = tag.word;
        this.querySelector('.bz-tag-name').textContent = tag.word;
        this.querySelector('button').classList.add(
            tag.isHighlighted
                ? 'btn-outline-primary'
                : 'btn-outline-secondary'
        );

        tagsManager.add(this);
    }

    connectedCallback() {
        this.addEventListener('click', event => {
            if (this.querySelector('button').classList.contains('active')) {
                tagsManager.check(this.dataset['tag']);
            } else {
                tagsManager.uncheck(this.dataset['tag']);
            }
        });
    }
}

customElements.define('bookmark-tag', BookmarkTagElement);

async function loadAndParsePage() { // Load page data manually
    const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab || tab.url.match(/^chrome:/)) {
        document.querySelector('[data-bs-target="#flush-collapseNewBookmark"]').closest('.accordion-item').style.display = 'none';

        const searchBookmarksSection = new bootstrap.Collapse(document.querySelector('#flush-collapseSearchBookmarks'));
        searchBookmarksSection.show();

        return;
    }

    document.querySelector('#inputUrl').value = tab.url;

    const activeTabId = tab.id;

    chrome.scripting.executeScript(
        {
            target: { tabId: activeTabId },
            function: () => {
                return {
                    title: document.title,
                    text: document.documentElement.innerText
                };
            }
        },

        async (results) => {
            if (!results || !results.length) {
                return;
            }

            const pageTitle = results[0].result.title;
            document.querySelector('#inputTitle').value = pageTitle;

            let pageText = results[0].result.text;
            if (pageText.length > 65536) {
                pageText = pageText.slice(0, 65536);
            }
            pageText = pageText + ' ' + pageTitle;

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
            let maxCount = 0;
            wordCountsArray.forEach((word) => {
                const wordLower = word.word.toLowerCase();
                if (typeof wordsReducedHash[wordLower] === 'undefined') {
                    word.word = wordLower;
                    wordsReducedHash[wordLower] = word;
                } else {
                    wordsReducedHash[wordLower].count += word.count;
                }

                if (wordsReducedHash[wordLower].count > maxCount) {
                    maxCount = wordsReducedHash[wordLower].count;
                }
            });

            const totals = await db.getTotals();

            totals.tags.forEach((tag) => {
                if (wordsReducedHash[tag]) {
                    wordsReducedHash[tag].count = maxCount + 1;
                    wordsReducedHash[tag].isHighlighted = true;
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

            // If there are ANY words already in user tags then display them first

            const selectedWords = wordsReducedArray.slice(wordsReducedArray.length - 10).reverse();
            selectedWords.forEach((word) => {
                document.querySelector('#suggestedTagsPane').appendChild(new BookmarkTagElement(word));
            });
        }
    );
}

const accordions = document.querySelectorAll('.accordion-collapse');
let opening = false;
accordions.forEach((el) => {
    el.addEventListener('hide.bs.collapse', (event) => {
        if (!opening) {
            event.preventDefault();
            event.stopPropagation();
        } else {
            opening = false;
        }
    });

    el.addEventListener('show.bs.collapse', (event) => {
        opening = true;
    });
});

document.querySelector('#importBookmarksAction').addEventListener('click', function() {
    this.disabled = true;

    chrome.bookmarks.getTree((bookmarkNodes) => {
        function processNode(node, tags = []) {
            return new Promise(async function(resolve) {
                if (node.url) {
                    await db.addUrl(node.url, node.title, tags);
                }

                if (node.children) {
                    const nextTags = node.title.length
                        ? [ ...tags, node.title.toLowerCase() ]
                        : [];

                    node.children.forEach(async function(node) {
                        await processNode(node, nextTags);
                    });
                }

                resolve();
            });
        }

        const bookmarkNodePromises = [];
        bookmarkNodes.forEach((node) => {
            bookmarkNodePromises.push(processNode(node));
        });

        Promise.all(bookmarkNodePromises).then(() => {
            this.disabled = false;
        });
    });
});

document.addEventListener('click', (e) => {
    const target = e.target.closest('.close-popup');
    if (target) {
        window.close();
    }
});

