import Tags from './node_modules/bootstrap5-tags/tags.min.js';
import Repository from './scripts/Repository.js';
import extractTags from './scripts/extractTags.js';
import { PagedArrayDataSource, PaginationBlockElement } from './assets/components/bs-pagination-block/component.js';

EventTarget.prototype.$on = function(events, handlerOrSelector, handler = null) {
    const wrapper = (e) => {
        if (typeof(handlerOrSelector) === 'function') {
            return handlerOrSelector.call(this, e);
        }

        const target = e.target.closest(handlerOrSelector);
        if (target && handler) {
            return handler.call(target, e);
        }
    };

    if (!Array.isArray(events)) {
        events = [ events ];
    }

    events.forEach((event) => {
        this.addEventListener(events, wrapper);
    });

    return this;
}

Document.prototype.$ = DocumentFragment.prototype.$ = Element.prototype.$ = function(selector, callback = null) {
    const element = this.querySelector(selector);

    if (callback) {
        callback(element);
    }

    return element;
}

Document.prototype.$$ = DocumentFragment.prototype.$$ = Element.prototype.$$ = function(selector, callback = null) {
    const elements = this.querySelectorAll(selector);

    if (callback) {
        elements.forEach(callback);
    }

    return elements;
}

const urlInputEl = document.$('#inputUrl');
const titleInputEl = document.$('#inputTitle');
const tagsInputEl = document.$('#inputTags');

const tagsSearchEl = document.$('#searchTags');

const bookmarkFormEl = document.$('#bookmarkForm');

const bookmarkSection = new bootstrap.Collapse(document.$('#flush-collapseBookmark'), {
    toggle: false
});
console.log(bookmarkSection);
const searchSection = new bootstrap.Collapse(document.$('#flush-collapseSearch'), {
    toggle: false
});
const settingsSection = new bootstrap.Collapse(document.$('#flush-collapseSettings'), {
    toggle: false
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.type === 'popupData') {
        console.log('Data received:', request.data);
    }
});

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

        Tags.init('#' + tagsInputEl.id, {
//            'items': tags,

            'inputFilter': (input) => {
                return input.trim().toLowerCase();
            },

            'onCreateItem': (item, t) => {
                if (item.dataset.value) {
/*
                    item.dataset.value = item.dataset.value.toLowerCase();
                    item.value = item.textContent = item.dataset.value;
                    console.log(item, t);
*/
                    tagsInputManager.check(item.dataset.value, false);
                }
            },

            'onSelectItem': (item) => {
                tagsInputManager.check(item.value, false);
            },

            'onClearItem': (item) => {
                tagsInputManager.uncheck(item);
            }
        });

        Tags.init('#' + tagsSearchEl.id, {
//            'items': tags,

            'onSelectItem': (item) => {
                // tagsInputManager.check(item.value, false);
            },

            'onClearItem': (item) => {
                // tagsInputManager.uncheck(item);
            }
        });

const repository = new Repository(async () => {
    repository.loadTags().then((tags) => {
        tagsInputManager.setData(tags.map((tag) => {
            return {
                label: tag,
                value: tag
            };
        }));

        loadAndParsePage();
    });

    repository.loadTotals().then((totals) => {
        totals.recentTags.forEach((tag) => {
            const word = {
                word:           tag,
                isHighlighted:  true
            };

            document.$('#recentTagsPane').appendChild(new BookmarkTagElement(word));
        });
    });

    repository.loadMostUsed().then((mostUsed) => {
        mostUsed.forEach((tag) => {
            const word = {
                word:           tag.name,
                isHighlighted:  true
            };

            document.$('#mostUsedTagsPane').appendChild(new BookmarkTagElement(word));
        });
    });

    loadBookmarksTable();
});

class TagsManager {
    constructor(el) {
        if (typeof el === 'string') {
            this.el = document.$(el);
        } else if (el instanceof HTMLElement) {
            this.el = el;
        } else {
            throw new Error('Wrong element type passed');
        }

        this.tagsObject = Tags.getInstance(this.el);
        this.elements = [];
    }

    setData(data) {
        console.log('data:', data);
        console.log('tagsObject:', this.tagsObject);
        this.tagsObject.updateData(data);
    }

    add(element) {
        this.elements.push(element);
    }

    check(tag, shouldAddItem = true) {
        this.elements.forEach((element) => {
            if (element.dataset['tag'] === tag) {
                element.$('.btn-check', (el) => {
                    el.checked = true;
                });
            }
        });

        if (shouldAddItem) {
            this.tagsObject.addItem(tag, tag);
            this.tagsObject.s.placeholder = '';
        }
    }

    uncheck(tag) {
        this.elements.forEach((element) => {
            if (element.dataset['tag'] === tag) {
                element.$('.btn-check', (el) => {
                    el.checked = false;
                });
            }
        });

        this.tagsObject.removeItem(tag);
        if (this.tagsObject.getSelectedValues().length === 0) {
            this.tagsObject.s.placeholder = this.el.$('option:first-child').label;
        }
    }
}

const tagsInputManager = new TagsManager(tagsInputEl);

class BookmarkTagElement extends HTMLElement {
    static idCounter = 0;

    constructor(tag) {
        super();

        BookmarkTagElement.idCounter++;

        const templateContent = document.$('#bookmarkTagTemplate').content.cloneNode(true);
        this.appendChild(templateContent);
        this.dataset['tag'] = tag.word;
        this.$('.btn-check').id = 'bzBookmarkTag-' + BookmarkTagElement.idCounter;
        this.$('.bz-tag-name').textContent = tag.word;
        this.$('.bz-tag-name').htmlFor = 'bzBookmarkTag-' + BookmarkTagElement.idCounter;
        this.$('.btn').classList.add(
            tag.isHighlighted
                ? 'btn-outline-primary'
                : 'btn-outline-secondary'
        );

        tagsInputManager.add(this);
    }

    connectedCallback() {
        this.$on('click', (e) => {
            if (this.$('.btn-check').checked) {
                tagsInputManager.check(this.dataset['tag']);
            } else {
                tagsInputManager.uncheck(this.dataset['tag']);
            }
        });
    }
}

customElements.define('bz-bookmark-tag', BookmarkTagElement);

let isLoadedToEdit = false;

async function loadAndParsePage() { // Load page data manually
    const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

    // Hide "Add Bookmark" section and open "Search Bookmark" if current tab is blank or it's Chromium service page
    if (!tab || tab.url.match(/^chrome:/)) {
        searchSection._element.closest('.accordion-item').classList.remove('d-none');
        settingsSection._element.closest('.accordion-item').classList.remove('d-none');

        searchSection.show();
        tagsSearchEl.focus();

        return;
    }

    urlInputEl.value = tab.url;
    tagsInputEl.focus();

    const hostname = (new URL(tab.url)).hostname.toLowerCase().replace(/^www\./, '');

    const activeTabId = tab.id;

    const bookmark = await repository.loadBookmark(tab.url);
    if (bookmark) {
        bookmarkFormEl.dataset['mode'] = 'edit';

        if (!isLoadedToEdit) {
            isLoadedToEdit = true;
        }
    }

    bookmarkSection._element.closest('.accordion-item').classList.remove('d-none');

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

            const tags = await repository.loadTags();
            const title = results[0].result.title;
            const text = results[0].result.text;

            titleInputEl.value = title;

            const selectedTags = extractTags(hostname, title, text, tags);

            document.$('#suggestedTagsPane').replaceChildren(...selectedTags.map((tag) => new BookmarkTagElement(tag)));

            if (bookmark) {
                titleInputEl.value = bookmark.title;

                bookmark.tags.forEach((tag) => {
                    tagsInputManager.check(tag, true);
                });
            }
        }
    );
}

let opening = false;
document.$('#accPanels').$on('hide.bs.collapse', '.accordion-collapse', (e) => {
    if (!opening) {
        e.preventDefault();
        e.stopPropagation();
    } else {
        opening = false;
    }
});
document.$('#accPanels').$on('show.bs.collapse', '.accordion-collapse', (e) => {
    opening = true;
});

document.$('#importBookmarksAction').$on('click', function(e) {
    this.disabled = true;

    chrome.bookmarks.getTree((bookmarkNodes) => {
        function processNode(node, folders = []) {
            return new Promise(async function(resolve) {
                if (node.url) {
                    await repository.storeBookmark(node.url, node.title, folders);
                }

                if (node.children) {
                    const nextFolders = node.title.length
                        ? [ ...folders, node.title.toLowerCase() ]
                        : [];

                    node.children.forEach(async function(node) {
                        await processNode(node, nextFolders);
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

document.$on('click', '.bz-menu-open-bookmark', (e) => {
    e.target.closest('.bz-bookmark-row').$('.bz-bookmark-link').click();
});

document.$on('click', '.bz-menu-remove-bookmark', (e) => {
    const url = e.target.closest('.bz-bookmark-row').$('.bz-bookmark-link').href;

    bookmarkConfirmRemove(url);
});

document.$on('click', '.bz-bookmark-link', (e) => {
    // e.preventDefault();
});

document.$on('click', '.bz-menu-edit-bookmark', (e) => {
    const rowEl = e.target.closest('.bz-bookmark-row');
    const url = rowEl.$('.bz-bookmark-link').href;

    Tags.getInstance(tagsInputEl).removeAll();

    repository.loadBookmark(url).then((bookmark) => {
        urlInputEl.value = bookmark.url;
        titleInputEl.value = bookmark.title;

        window
            .fetch(bookmark.url)
            .then(response => response.text())
            .then(html => {
                const hostname = (new URL(bookmark.url)).hostname.toLowerCase().replace(/^www\./, '');
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const elementsToRemove = doc.querySelectorAll('script, style');
                elementsToRemove.forEach(el => el.remove());
                const text = doc.body.textContent || '';
                repository.loadTags().then((tags) => {
                    const selectedTags = extractTags(hostname, bookmark.title, text, tags);
                    console.log('>>>', selectedTags);

                    document.$('#suggestedTagsPane').replaceChildren(...selectedTags.map((tag) => new BookmarkTagElement(tag)));

                    bookmark.tags.forEach((tag) => {
                        tagsInputManager.check(tag, true);
                    });
                });
            })
            .catch((error) => {
                console.error('Error fetching page:', error);
            });
    });

    bookmarkSection._element.closest('.accordion-item').classList.remove('d-none');
    bookmarkFormEl.dataset['mode'] = 'edit';
    bookmarkSection.show();

    tagsInputEl.focus();
});

document.$on('click', '.bz-close-popup', (e) => {
    window.close();
});

document.$on('click', '#cancelBookmarkEdit', (e) => {
    bookmarkEditFinished();
});

document.$('#removeBookmark').$on('click', (e) => {
    bookmarkConfirmRemove(urlInputEl.value);
});

bookmarkFormEl.$on('submit', async (e) => {
    e.preventDefault();

    const inputTags = Tags.getInstance(tagsInputEl);
    await repository.storeBookmark(urlInputEl.value, titleInputEl.value, inputTags.getSelectedValues());

    bookmarkEditFinished();
});

function bookmarkEditFinished() {
    chrome.runtime.sendMessage({ command: 'check' });

    if (!isLoadedToEdit && (bookmarkFormEl.dataset['mode'] == 'edit')) {
        loadBookmarksTable();

        backToSearch();
    } else {
        window.close();
    }
}

function backToSearch() {
    Tags.getInstance(tagsInputEl).removeAll();

//    loadAndParsePage();

//    bookmarkFormEl.dataset['mode'] = 'new';

    bookmarkSection._element.closest('.accordion-item').classList.add('d-none');

    searchSection.show();
}

function loadBookmarksTable() {
    repository.loadBookmarksFiltered([], (bookmarks) => {
        document.$('bs-pagination-block').setDataProvider(new PagedArrayDataSource(bookmarks));
    });
}

function bookmarkConfirmRemove(url) {
    if (window.confirm('Remove this bookmark?')) {
        repository.removeBookmark(url).then(() => {
            bookmarkEditFinished();
        }).catch((e) => {
            console.error(e)
        });
    }
}

