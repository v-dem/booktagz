// import XRegExp from './node_modules/xregexp/xregexp-all.js';
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

    return this.querySelector(selector);
}

Document.prototype.$$ = DocumentFragment.prototype.$$ = Element.prototype.$$ = function(selector, callback = null) {
    const elements = this.querySelectorAll(selector);

    if (callback) {
        elements.forEach(callback);
    }

    return elements;
}

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

const repository = new Repository(function() {
    repository.getTotals().then((totals) => {
        Tags.init('#' + tagsInput.id, {
            'items': totals.tags.reduce((obj, item) => {
                obj[item] = item;
                return obj;
            }, {}),

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
                    tagsManager.check(item.dataset.value, false);
                }
            },

            'onSelectItem': (item) => {
                tagsManager.check(item.value, false);
            },

            'onClearItem': (item) => {
                tagsManager.uncheck(item);
            }
        });

        Tags.init('#' + tagsSearch.id, {
            'items': totals.tags.reduce((obj, item) => {
                obj[item] = item;
                return obj;
            }, {}),

            'onSelectItem': (item) => {
                // tagsManager.check(item.value, false);
            },

            'onClearItem': (item) => {
                // tagsManager.uncheck(item);
            }
        });

        totals.recent.forEach((tag) => {
            const word = {
                word:           tag,
                isHighlighted:  true
            };

            document.$('#recentTagsPane').appendChild(new BookmarkTagElement(word));
        });
    });

    loadAndParsePage();

    repository.loadMostUsed().then((mostUsed) => {
        mostUsed.forEach((tag) => {
            const word = {
                word:           tag.name,
                isHighlighted:  true
            };

            document.$('#mostUsedTagsPane').appendChild(new BookmarkTagElement(word));
        });
    });

    repository.loadBookmarksFiltered([], (bookmarks) => {
        document.$('bs-pagination-block').setDataProvider(new PagedArrayDataSource(bookmarks));
    });
});

const tagsManager = {
    elements: [],

    add: function(element) {
        this.elements.push(element);
    },

    check: function(tag, shouldAddItem = true) {
        this.elements.forEach((element) => {
            if (element.dataset['tag'] === tag) {
                element.$('button', (el) => {
                    el.classList.add('active');
                    el.ariaPressed = true;
                });
            }
        });

        if (shouldAddItem) {
            const inputTags = Tags.getInstance(tagsInput);
            inputTags.addItem(tag, tag);
            inputTags.s.placeholder = '';
        }
    },

    uncheck: function(tag) {
        this.elements.forEach((element) => {
            if (element.dataset['tag'] === tag) {
                element.$('button', (el) => {
                    el.classList.remove('active');
                    el.ariaPressed = false;
                });
            }
        });

        const inputTags = Tags.getInstance(tagsInput);
        inputTags.removeItem(tag);
        if (inputTags.getSelectedValues().length === 0) {
            inputTags.s.placeholder = tagsInput.$('option:first-child').label;
        }
    }
}

class BookmarkTagElement extends HTMLElement {
    constructor(tag) {
        super();

        const templateContent = document.$('#bookmarkTagTemplate').content.cloneNode(true);
        this.appendChild(templateContent);
        this.dataset['tag'] = tag.word;
        this.$('.bz-tag-name').textContent = tag.word;
        this.$('button').classList.add(
            tag.isHighlighted
                ? 'btn-outline-primary'
                : 'btn-outline-secondary'
        );

        tagsManager.add(this);
    }

    connectedCallback() {
        this.$on('click', (e) => {
            if (this.$('button').classList.contains('active')) {
                tagsManager.check(this.dataset['tag']);
            } else {
                tagsManager.uncheck(this.dataset['tag']);
            }
        });
    }
}

customElements.define('bz-bookmark-tag', BookmarkTagElement);

const urlInput = document.$('#inputUrl');
const titleInput = document.$('#inputTitle');
const tagsInput = document.$('#inputTags');
const tagsSearch = document.$('#searchTags');

const bookmarkForm = document.$('#bookmarkForm');

async function loadAndParsePage() { // Load page data manually
    const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab || tab.url.match(/^chrome:/)) {
        document.$('[data-bs-target="#flush-collapseNewBookmark"]').closest('.accordion-item').style.display = 'none';

        const searchBookmarksSection = new bootstrap.Collapse(document.$('#flush-collapseSearchBookmarks'));
        searchBookmarksSection.show();

        tagsSearch.focus();

        return;
    }

    urlInput.value = tab.url;
    tagsInput.focus();

    const hostname = (new URL(tab.url)).hostname.toLowerCase().replace(/^www\./, '');

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

            const totals = await repository.getTotals();
            const title = results[0].result.title;
            const text = results[0].result.text;

            titleInput.value = title;

            const selectedTags = extractTags(hostname, title, text, totals.tags);
            selectedTags.forEach((tag) => {
                document.$('#suggestedTagsPane').appendChild(new BookmarkTagElement(tag));
            });
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
        function processNode(node, tags = []) {
            return new Promise(async function(resolve) {
                if (node.url) {
                    await repository.addUrl(node.url, node.title, tags);
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

document.$on('click', '.bz-menu-open-bookmark', (e) => e.target.closest('.bz-bookmark-row').$('.bz-bookmark-link').click());

document.$on('click', '.bz-close-popup', () => window.close());

bookmarkForm.$on('submit', (e) => {
    e.preventDefault();

    
});

