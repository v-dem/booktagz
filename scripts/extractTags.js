function extractTags(hostname, pageTitle, pageText, knownWords = []) {
    if (pageText.length > 65536) {
        pageText = pageText.slice(0, 65536);
    }
    pageText = pageText + ' ' + pageTitle;

    const words = pageText.replace(/[`~!@#$%^&*()|+=?;:…"«»„“—−,<>\{\}\[\]\\\/]/gi, '').replace(/\s+/g, ' ').replace(/\n/g, ' ').split(' ');
    // const words = pageText.split(/\s+/).filter((word) => (new XRegExp('^\\p{L}')).test(word)); // TODO: Use xregexp

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

    knownWords.forEach((word) => {
        if (wordsReducedHash[word]) {
            wordsReducedHash[word].count = maxCount + 2; // Tags which were found in the database will be displayed first
            wordsReducedHash[word].isHighlighted = true;
        }
    });

    if (wordsReducedHash[hostname]) {
        wordsReducedHash[hostname].count = maxCount + 3; // If hostname tag is in the database it will be displayed at the very beginning of all
    } else {
        wordsReducedHash[hostname] = {
            word:           hostname,
            count:          maxCount + 1, // If hostname tag is not yet in the database, it will appear after tags already found
            isHighlighted:  false
        };
    }

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

    return wordsReducedArray.slice(wordsReducedArray.length - 10).reverse();
}

export default extractTags;

