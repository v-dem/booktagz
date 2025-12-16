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
    }

    async connectedCallback() {
        const response = await fetch(import.meta.url.replace(/\.js/, '.html'));

        this.innerHTML = await response.text();

        this.addEventListener('click', function(e) {
            const target = e.target.closest('.page-link');
            if (target) {
                this.switchToPage(target.dataset['page']);
            }
        });
    }

    setDataProvider(dataProvider) {
        this.dataProvider = dataProvider;

        this.renderPageLinks();
        this.switchToPage(1);
    }

    renderPageLinks() {
        const container = this.querySelector('ul');
        container.replaceChildren(
            container.firstElementChild,
            container.lastElementChild
        );

        for (let i = 0; i < Math.min(10, this.dataProvider.getPagesCount()); i++) {
            const templateContent = this.querySelector('#paginationLinkTemplate').content.cloneNode(true);
            templateContent.querySelector('.page-link').textContent = i + 1;
            templateContent.querySelector('.page-link').dataset['page'] = i + 1;

            container.insertBefore(templateContent, container.lastElementChild);
        }

        setTimeout(() => {
            console.log(container.getBoundingClientRect().width, container.parentElement.getBoundingClientRect().width, container.parentElement.parentElement.getBoundingClientRect().width);
        }, 0);
    }

    switchToPage(page) {
        this.currentPage = page;

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

    renderPageRows() {
        const container = document.querySelector(this.dataset['container']);
        container.replaceChildren();

        const pages = this.dataProvider.getPage(this.currentPage - 1);
        for (let i = 0; i < pages.length; i++) {
            const templateContent = document.querySelector(this.dataset['rowTemplate']).content.cloneNode(true);
            templateContent.querySelectorAll('[data-property]').forEach(function(el) {
                el.textContent = pages[i][el.dataset['property']];
            });
            templateContent.querySelectorAll('[data-attribute]').forEach(function(el) {
                el.setAttribute(el.dataset['attribute'], pages[i][el.dataset['attributeProperty']]);
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

