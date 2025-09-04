// Search functionality
class SearchManager {
    constructor() {
        this.searchInput = document.getElementById('searchInput');
        this.searchResults = document.getElementById('searchResults');
        this.debounceTimer = null;
        
        this.init();
    }
    
    init() {
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                clearTimeout(this.debounceTimer);
                this.debounceTimer = setTimeout(() => {
                    this.performSearch(e.target.value);
                }, 300);
            });
        }
    }
    
    performSearch(query) {
        if (!query.trim()) {
            this.clearResults();
            return;
        }
        
        const searchQuery = query.toLowerCase();
        const results = BlogState.articles.filter(article => {
            return (
                article.title.toLowerCase().includes(searchQuery) ||
                article.excerpt.toLowerCase().includes(searchQuery) ||
                article.content.toLowerCase().includes(searchQuery) ||
                article.category.toLowerCase().includes(searchQuery) ||
                article.tags.some(tag => tag.toLowerCase().includes(searchQuery))
            );
        });
        
        this.displayResults(results, query);
    }
    
    displayResults(results, query) {
        if (!this.searchResults) return;
        
        if (results.length === 0) {
            this.searchResults.innerHTML = `
                <div class="search-result-item">
                    <div class="search-result-title">No results found</div>
                    <div class="search-result-excerpt">Try different keywords or browse our categories.</div>
                </div>
            `;
            return;
        }
        
        this.searchResults.innerHTML = results.map(article => `
            <div class="search-result-item" onclick="window.location.href='article.html?slug=${article.slug}'">
                <div class="search-result-title">${this.highlightText(article.title, query)}</div>
                <div class="search-result-excerpt">${this.highlightText(article.excerpt, query)}</div>
            </div>
        `).join('');
    }
    
    highlightText(text, query) {
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }
    
    clearResults() {
        if (this.searchResults) {
            this.searchResults.innerHTML = '';
        }
    }
}

// Initialize search when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('searchInput')) {
        new SearchManager();
    }
});