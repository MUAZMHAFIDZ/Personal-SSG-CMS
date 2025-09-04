// Global state management
const BlogState = {
    articles: [],
    currentArticle: null,
    searchResults: [],
    
    async loadArticles() {
        try {
            const response = await fetch('data/articles.json');
            this.articles = (await response.json()).articles;
        } catch (error) {
            console.error('Failed to load articles:', error);
            this.articles = [];
        }
    },
    
    getFeaturedArticles() {
        return this.articles.filter(article => article.featured);
    },
    
    getLatestArticles() {
        return this.articles
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 3);
    },
    
    getRecommendedArticles(currentId) {
        return this.articles
            .filter(article => article.id !== currentId)
            .slice(0, 3);
    },
    
    getArticleById(id) {
        return this.articles.find(article => article.id === id);
    },
    
    getArticleBySlug(slug) {
        return this.articles.find(article => article.slug === slug);
    }
};

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

function createPostCard(article) {
    return `
        <article class="post-card fade-in">
            <img src="${article.image}" alt="${article.title}" class="post-image">
            <div class="post-content">
                <div class="post-meta">
                    <span class="post-category">${article.category}</span>
                    <span class="post-date">${formatDate(article.date)}</span>
                </div>
                <h3 class="post-title">
                    <a href="article.html?slug=${article.slug}">${article.title}</a>
                </h3>
                <p class="post-excerpt">${article.excerpt}</p>
                <div class="post-author">
                    <img src="https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=100" alt="${article.author}" class="author-avatar">
                    <div class="author-info">
                        <h4>${article.author}</h4>
                        <p>Creative Writer</p>
                    </div>
                </div>
            </div>
        </article>
    `;
}

function createArticlePreview(article) {
    return `
        <article class="article-preview fade-in">
            <img src="${article.image}" alt="${article.title}" class="preview-image">
            <div class="preview-content">
                <div class="post-meta">
                    <span class="post-category">${article.category}</span>
                    <span class="post-date">${formatDate(article.date)}</span>
                </div>
                <h3><a href="article.html?slug=${article.slug}">${article.title}</a></h3>
                <p class="post-excerpt">${article.excerpt}</p>
                <div class="post-tags">
                    ${article.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
            </div>
        </article>
    `;
}

// Page initialization
function initHomePage() {
    const featuredContainer = document.getElementById('featuredPosts');
    const latestContainer = document.getElementById('latestPosts');
    
    if (featuredContainer) {
        const featured = BlogState.getFeaturedArticles();
        featuredContainer.innerHTML = featured.map(createPostCard).join('');
    }
    
    if (latestContainer) {
        const latest = BlogState.getLatestArticles();
        latestContainer.innerHTML = latest.map(createPostCard).join('');
    }
}

function initBlogPage() {
    const articlesContainer = document.getElementById('articlesList');
    
    if (articlesContainer) {
        const allArticles = BlogState.articles
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        articlesContainer.innerHTML = allArticles.map(createArticlePreview).join('');
    }
    
    // Category filtering
    const categoryLinks = document.querySelectorAll('[data-category]');
    categoryLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const category = e.target.dataset.category;
            filterByCategory(category);
        });
    });
}

function filterByCategory(category) {
    const articlesContainer = document.getElementById('articlesList');
    const filtered = BlogState.articles.filter(article => 
        article.category.toLowerCase() === category.toLowerCase()
    );
    articlesContainer.innerHTML = filtered.map(createArticlePreview).join('');
}

// Navigation and search setup
function initNavigation() {
    // Mobile menu toggle (for future expansion)
    const searchToggle = document.getElementById('searchToggle');
    const searchOverlay = document.getElementById('searchOverlay');
    const searchClose = document.getElementById('searchClose');
    
    if (searchToggle && searchOverlay) {
        searchToggle.addEventListener('click', () => {
            searchOverlay.classList.add('active');
            document.getElementById('searchInput')?.focus();
        });
    }
    
    if (searchClose && searchOverlay) {
        searchClose.addEventListener('click', () => {
            searchOverlay.classList.remove('active');
        });
    }
    
    // Close search on overlay click
    if (searchOverlay) {
        searchOverlay.addEventListener('click', (e) => {
            if (e.target === searchOverlay) {
                searchOverlay.classList.remove('active');
            }
        });
    }
    
    // Newsletter form
    const newsletterForm = document.querySelector('.newsletter-form');
    if (newsletterForm) {
        const button = newsletterForm.querySelector('.newsletter-button');
        const input = newsletterForm.querySelector('.newsletter-input');
        
        button.addEventListener('click', (e) => {
            e.preventDefault();
            if (input.value.trim()) {
                button.innerHTML = '<span>✓ Subscribed!</span>';
                setTimeout(() => {
                    button.innerHTML = '<span>Subscribe</span><span class="button-icon">✉</span>';
                    input.value = '';
                }, 2000);
            }
        });
    }
}

// Animation observers
function setupAnimations() {
    const observeElements = () => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('fade-in');
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });
        
        document.querySelectorAll('.post-card, .article-preview, .topic-card').forEach(el => {
            observer.observe(el);
        });
    };
    
    // Delay to ensure DOM is ready
    setTimeout(observeElements, 100);
}

// Initialize based on current page
async function initializeApp() {
    await BlogState.loadArticles();
    
    const currentPage = window.location.pathname;
    
    if (currentPage.includes('index.html') || currentPage === '/') {
        initHomePage();
    } else if (currentPage.includes('blog.html')) {
        initBlogPage();
    }
    
    initNavigation();
    setupAnimations();
}

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);