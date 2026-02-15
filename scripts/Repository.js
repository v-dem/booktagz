class Repository {
    constructor(onload = null) {
        this.onload = onload;

        const request = window.indexedDB.open('booktagzDb', 1);
        request.onerror = (e) => {
            console.error('Why didn\'t you allow my web app to use IndexedDB?!');
            console.log(e);
        };

        request.onsuccess = (e) => {
            this.idb = e.target.result;

            if (this.onload) {
                this.onload();
            }
        };

        request.onupgradeneeded = (e) => {
            // Database schema:
            // - bookmarks (url (unique), title, tags[])
            // - tags (name (unique), urls[])
            // - totals (1, tags[])

            const db = e.target.result;

            db.createObjectStore('bookmarks', { keyPath: 'url' });

            db.createObjectStore('tags', { keyPath: 'name' });

            const totalsStore = db.createObjectStore('totals', { autoIncrement: true });
            totalsStore.add({
                tags: [],
                recent: []
            });
        };
    }

    loadRecords(store, keys, callback, transaction = null) {
        if (!transaction) {
            transaction = this.idb.transaction([ store ], 'readonly');
        }

        const objectStore = transaction.objectStore(store);

        const results = {};
        Promise.all(keys.map(key => {
            return new Promise((resolve, reject) => {
                const request = objectStore.get(key);
                request.onsuccess = (e) => {
                    results[key] = e.target.result;
                    resolve();
                };
                request.onerror = (e) => {
                    console.error('Error fetching record:', e.target.error);
                    reject(e.target.error);
                };
            });
        }))
        .then(() => {
            callback(results);
        });
    }

    loadTagsSet(tags, callback, transaction = null) {
        loadRecords(this.idb, 'tags', tags, callback, transaction);
    }

    loadBookmarksSet(urls, callback, transaction = null) {
        loadRecords(this.idb, 'bookmarks', urls, callback, transaction);
    }

    addBookmark(url, title, tags) {
        return new Promise((resolve, reject) => {
            // 1. Check all tags, if not exist create and add this url, if exist append this url
            const transaction = this.idb.transaction([ 'tags', 'bookmarks', 'totals' ], 'readwrite');

            transaction.oncomplete = function() {
                resolve();
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
    }

    getTotals() {
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
    }

    loadMostUsed() {
        return new Promise((resolve, reject) => {
            const transaction = this.idb.transaction([ 'tags' ], 'readonly');
            const store = transaction.objectStore('tags');
            store.getAll().onsuccess = (e) => {
                const allTags = e.target.result;
                allTags.sort(function(a, b) {
                    if (a.urls.length < b.urls.length) {
                        return -1;
                    }

                    if (a.urls.length > b.urls.length) {
                        return 1;
                    }

                    return 0;
                });

                resolve(allTags.slice(-10).reverse());
            };
        });
    }

    loadBookmarksFiltered(tags = [], callback) {
        if (tags.length) {
            this.loadTagsSet(tags, (tagRecords) => {
                console.log(tagRecords);

                // TODO: Filter all urls for all tags
            });
        } else {
            const transaction = this.idb.transaction([ 'bookmarks' ], 'readonly');
            const store = transaction.objectStore('bookmarks');
            store.getAll().onsuccess = (e) => {
                callback(e.target.result);
            };
        }
    }
}

export default Repository;

