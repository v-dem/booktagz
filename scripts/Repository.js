class Repository {
    constructor(onload = null) {
        this.onload = onload;

        const request = indexedDB.open('booktagzDb', 1);
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
            // - totals (1, recentTags[])

            const db = e.target.result;

            db.createObjectStore('bookmarks', { keyPath: 'url' });

            db.createObjectStore('tags', { keyPath: 'name' });

            const totalsStore = db.createObjectStore('totals', { autoIncrement: true });
            totalsStore.add({
                recentTags: []
            });
        };
    }

    loadRecords(store, keys, callback, transaction = null) {
        if (!transaction) {
            transaction = this.idb.transaction([ store ], 'readonly');
        }

        const objectStore = transaction.objectStore(store);

        const results = {};
        const p = Promise.all(keys.map(key => {
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
        }));

        p.then(() => {
            callback(results);
        });
    }

    loadTagsSet(tags, callback, transaction = null) {
        this.loadRecords('tags', tags, callback, transaction);
    }

    loadBookmarksSet(urls, callback, transaction = null) {
        this.loadRecords('bookmarks', urls, callback, transaction);
    }

    loadBookmark(url) {
        return new Promise((resolve, reject) => {
            this.loadBookmarksSet([ url ], (results) => resolve(results.length > 0 ? results[0] : null));
        });
    }

    storeBookmark(url, title, tags) {
        console.log(url, title, tags);
        return new Promise((resolve, reject) => {
            const transaction = this.idb.transaction([ 'tags', 'bookmarks', 'totals' ], 'readwrite');
            transaction.oncomplete = function() {
                resolve();
            };
            transaction.onerror = (e) => {
                reject(`storeBookmark() error: ${e.target.error?.message}`);
            };

            // 1. Store a bookmark
            const bookmarksStore = transaction.objectStore('bookmarks');
            bookmarksStore.get(url).onsuccess = (e) => {
                let oldTags = [];
                const bookmark = e.target.result;
                if (bookmark) {
                    oldTags = e.target.result.tags;

                    console.log('put', e.target.result);
                    bookmarksStore.put({
                        url: url,
                        title: title,
                        tags: tags
                    });
                } else {
                    console.log('add');
                    bookmarksStore.add({
                        url: url,
                        title: title,
                        tags: tags
                    });
                }

                // 2. Load tags with urls, if tag not exist create and add this url, if exist append this url
                this.loadTagsSet(oldTags, (existingTags) => {
                    console.log('existing', existingTags);
                    const tagsStore = transaction.objectStore('tags');
                    const newTags = [];
                    const removedTags = structuredClone(existingTags);
                    tags.forEach(tag => {
                        if (existingTags[tag]) {
                            delete removedTags[tag];
                        }

                        const tagCheck = tagsStore.get(tag);
                        tagCheck.onsuccess = (e) => {
                            if (e.target.result) {
                                if (-1 === e.target.result.urls.indexOf(url)) {
                                    e.target.result.urls.push(url);

                                    tagsStore.put(e.target.result);
                                }
                            } else {
                                tagsStore.add({
                                    name: tag,
                                    urls: [ url ]
                                });

                                newTags.push(tag);
                            }
                        }
                    });

                    // 3. Remove URLs in removedTags
                    for (const [tag, tagRecord] of Object.entries(removedTags)) {
                        console.log('---', tag, tagRecord);
                        const urlIndex = tagRecord
                            ? tagRecord.urls.indexOf(url)
                            : -1;
                        if (urlIndex > -1) {
                            tagRecord.urls.splice(urlIndex, 1);
                            if (tagRecord.urls.length) {
                                tagsStore.put(tagRecord);
                            } else {
                                tagsStore.delete(tag);
                            }
                        }
                    }

                    // 4. Update totals
                    const totalsStore = transaction.objectStore('totals');
                    totalsStore.get(1).onsuccess = (e) => {
                        const tagsObject = e.target.result;
                        tagsObject.recentTags = [ ...tagsObject.recentTags, ...newTags ];
                        if (tagsObject.recentTags.length > 10) {
                            tagsObject.recentTags = tagsObject.recentTags.slice(-10);
                        }

                        totalsStore.put(tagsObject, 1);
                    };
                }, transaction);
            };
        });
    }

    removeBookmark(url) {
        return new Promise((resolve, reject) => {
            const transaction = this.idb.transaction([ 'tags', 'bookmarks', 'totals' ], 'readwrite');
            transaction.oncomplete = function() {
                resolve();
            };
            transaction.onerror = (e) => {
                reject(`removeBookmark() error: ${e.target.error?.message}`);
            };

            // 1. Get a bookmark record
            const bookmarksStore = transaction.objectStore('bookmarks');
            bookmarksStore.get(url).onsuccess = (e) => {
                const bookmark = e.target.result;

                bookmarksStore.delete(url);

                // 2. Load tags with urls
                this.loadTagsSet(bookmark.tags, (tags) => {
                    // 3. Remove URLs from tags / Remove empty tags
                    const tagsStore = transaction.objectStore('tags');
                    for (const [tag, tagRecord] of Object.entries(tags)) {
                        const urlIndex = tagRecord
                            ? tagRecord.urls.indexOf(url)
                            : -1;
                        if (urlIndex > -1) {
                            tagRecord.urls.splice(urlIndex, 1);
                            if (tagRecord.urls.length) {
                                tagsStore.put(tagRecord);
                            } else {
                                tagsStore.delete(tag);
                            }
                        }
                    }
                }, transaction);
            };
        });
    }

    loadTotals() {
        return new Promise((resolve, reject) => {
            const transaction = this.idb.transaction([ 'totals' ], 'readonly');
            const store = transaction.objectStore('totals');
            store.get(1).onsuccess = (e) => {
                resolve(e.target.result);
            };

            transaction.onerror = (e) => {
                reject(`loadTotals() error: ${e.target.error?.message}`);
            };
        });
    }

    loadTags() {
        return new Promise((resolve, reject) => {
            const transaction = this.idb.transaction([ 'tags' ], 'readonly');
            const store = transaction.objectStore('tags');
            store.getAllKeys().onsuccess = (e) => {
                resolve(e.target.result);
            };

            transaction.onerror = (e) => {
                reject(`loadTags() error: ${e.target.error?.message}`);
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

    loadBookmark(url) {
        return new Promise((resolve, reject) => {
            const transaction = this.idb.transaction([ 'bookmarks' ], 'readonly');
            const store = transaction.objectStore('bookmarks');
            store.get(url).onsuccess = (e) => {
                resolve(e.target.result);
            };
        });
    }
}

export default Repository;

