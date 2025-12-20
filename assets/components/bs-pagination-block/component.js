class PagedArrayDataSource {
    constructor(items, pageSize = 10) {
        if (!Array.isArray(items)) {
            throw new Error(`Argument "items" must be an array`);
        }

        if (pageSize <= 0) {
            throw new Error(`Argument "pageSize" must be greater than zero`);
        }

        this.items = items;
        this.pageSize = pageSize;
        this.pagesCount = Math.ceil(items.length / pageSize);
    }

    getPagesCount() {
        return this.pagesCount;
    }

    getPage(page) {
        if ((page >= this.pagesCount) || (page < 0)) {
            throw new Error(`Page index ${page} is out of range (0..${this.pagesCount - 1})`);
        }

        const startIndex = page * this.pageSize;

        return this.items.slice(startIndex, startIndex + this.pageSize);
    }
}

class PaginationBlockElement extends HTMLElement {
    constructor() {
        super();

        this.dataProvider = new PagedArrayDataSource([], 10);
        this.currentPage = 1;

        console.log('constructor');
    }

    async connectedCallback() {
        console.log('connectedCallback');
        const response = await fetch(import.meta.url.replace(/\.js/, '.html'));

        this.innerHTML = await response.text();

        this.addEventListener('click', function(e) {
            const target = e.target.closest('.page-link');
            if (target) {
                if (target.classList.contains('prev') && (this.currentPage > 1)) {
                    this.switchToPage(this.currentPage - 1);
                } else if (target.classList.contains('next') && (this.currentPage < this.dataProvider.getPagesCount())) {
                    this.switchToPage(this.currentPage + 1);
                } else {
                    this.switchToPage(target.dataset['page']);
                }
            }
        });
    }

    setDataProvider(dataProvider) {
        console.log('setDataProvider');
        this.dataProvider = dataProvider;

        this.switchToPage(1);
    }

    switchToPage(page) {
        console.log('switchToPage');
        this.currentPage = +page;

        this.renderPageLinks();

        const container = this.querySelector('ul');
        container.firstElementChild.classList.remove('disabled');
        container.lastElementChild.classList.remove('disabled');
        if (1 == this.currentPage) {
            container.firstElementChild.classList.add('disabled');
        }
        if (this.currentPage == this.dataProvider.getPagesCount()) {
            container.lastElementChild.classList.add('disabled');
        }

        this.querySelector('.page-item.active')?.classList.remove('active');

        this.querySelector(`.page-item:has(.page-link[data-page="${this.currentPage}"])`).classList.add('active');

        this.renderPageRows();
    }

    renderPageLinks() {
        console.log('renderPageLinks');

        const container = this.querySelector('ul');

        // Remove all links except first (Previous link) and last (Next link)
        container.replaceChildren(
            container.firstElementChild,
            container.lastElementChild
        );

        const createPageLink = (page) => {
            const templateContent = this.querySelector('#paginationLinkTemplate').content.cloneNode(true);
            templateContent.querySelector('.page-link').textContent = page;
            templateContent.querySelector('.page-link').dataset['page'] = page;

            return templateContent;
        }

        const createPageLinkDivider = () => {
            return this.querySelector('#paginationLinkRangeDividerTemplate').content.cloneNode(true);
        }

        const renderPageLinksPart = (startPage, count) => {
            for (let i = 0; i < count; i++) {
                container.insertBefore(createPageLink(startPage + i), container.lastElementChild);
            }
        }

        const sideCellsCount = 1;
        const centerSideCellsCount = 1;
        const centerCellsCount = centerSideCellsCount * 2 + 1;
        if (sideCellsCount * 2 + centerCellsCount >= this.dataProvider.getPagesCount()) {
            for (let i = 0; i < this.dataProvider.getPagesCount(); i++) {
                container.insertBefore(createPageLink(i + 1), container.lastElementChild);
            }
        } else {
            const leftDistance = this.currentPage - centerSideCellsCount - sideCellsCount - 1;
            const rightDistance = this.dataProvider.getPagesCount() - this.currentPage - centerSideCellsCount - sideCellsCount - 1;

            renderPageLinksPart(1, sideCellsCount); // Left end page links

            if (leftDistance > 1) {
                if (leftDistance > 4) {
                    container.insertBefore(createPageLinkDivider(), container.lastElementChild);
                    container.insertBefore(createPageLink(sideCellsCount + Math.ceil(leftDistance / 2)), container.lastElementChild);
                    container.insertBefore(createPageLinkDivider(), container.lastElementChild);
                } else {
                    container.insertBefore(createPageLinkDivider(), container.lastElementChild);
                }
            } else if (leftDistance == 1) {
                renderPageLinksPart(sideCellsCount + 1, 1);
            }

            let start = this.currentPage - centerSideCellsCount;
            let len = centerCellsCount;
            if (sideCellsCount + 1 > this.currentPage - centerSideCellsCount) {
                start = sideCellsCount + 1;
                len = this.currentPage - sideCellsCount + centerSideCellsCount;
            }
            if (start + centerCellsCount >= this.dataProvider.getPagesCount()) {
                len = this.dataProvider.getPagesCount() - start - 1;
            }

            renderPageLinksPart(start, len); // Render center page links

            if (rightDistance > 1) {
                if (rightDistance > 4) {
                    container.insertBefore(createPageLinkDivider(), container.lastElementChild);
                    container.insertBefore(createPageLink(this.currentPage + centerSideCellsCount + Math.ceil(rightDistance / 2)), container.lastElementChild);
                    container.insertBefore(createPageLinkDivider(), container.lastElementChild);
                } else {
                    container.insertBefore(createPageLinkDivider(), container.lastElementChild);
                }
            } else if (rightDistance == 1) {
                renderPageLinksPart(this.dataProvider.getPagesCount() - sideCellsCount - 1, 1);
            }

            renderPageLinksPart(this.dataProvider.getPagesCount() - sideCellsCount, sideCellsCount); // Right end page links
        }
    }

    renderPageRows() {
        console.log('renderPageRows');
        const container = document.querySelector(this.dataset['container']);
        container.replaceChildren();

        const pages = this.dataProvider.getPage(this.currentPage - 1);
        for (let i = 0; i < pages.length; i++) {
            const templateContent = document.querySelector(this.dataset['rowTemplate']).content.cloneNode(true);

            // Set element textContent from row object property specified
            templateContent.querySelectorAll('[data-content-property]').forEach(function(el) {
                el.textContent = pages[i][el.dataset['contentProperty']];
            });

            // Set element attribute from row object property specified
            templateContent.querySelectorAll('[data-attribute]').forEach(function(el) {
                el.setAttribute(el.dataset['attribute'], pages[i][el.dataset['attributeProperty']]);
            });

            // Set dataset value from row object property specified
            templateContent.querySelectorAll('[data-dataset]').forEach(function(el) {
                el.dataset[el.dataset['dataset']] = pages[i][el.dataset['datasetProperty']];
            });

            container.appendChild(templateContent);
        }
    }
}

customElements.define('bs-pagination-block', PaginationBlockElement);

export {
    PagedArrayDataSource,
    PaginationBlockElement
};

