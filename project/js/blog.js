// Blog page specific functionality
class BlogManager {
    constructor() {
        this.init();
    }
    
    init() {
        this.setupCategoryFilters();
        this.setupTagFilters();
    }
    
    setupCategoryFilters() {
        const categoryLinks = document.querySelectorAll('[data-category]');
        
        categoryLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Update active state
                categoryLinks.forEach(l => l.classList.remove('active'));
                e.target.classList.add('active');
                
                const category = e.target.dataset.category;
                this.filterArticles('category', category);
            });
        });
        
        // Add "All" option
        this.addAllCategoriesOption();
    }
    
    addAllCategoriesOption() {
        const categoryList = document.querySelector('.category-list');
        if (categoryList) {
            const allItem = document.createElement('li');
            allItem.innerHTML = '<a href="#" data-category="all" class="active">All Posts</a>';
            categoryList.insertBefore(allItem, categoryList.firstChild);
            
            allItem.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('[data-category]').forEach(l => l.classList.remove('active'));
                e.target.classList.add('active');
                this.showAllArticles();
            });
        }
    }
    
    setupTagFilters() {
        const tags = document.querySelectorAll('.tag');
        
        tags.forEach(tag => {
            tag.addEventListener('click', () => {
                const tagText = tag.textContent.toLowerCase();
                this.filterArticles('tag', tagText);
            });
        });
    }
    
    filterArticles(type, value) {
        const articlesContainer = document.getElementById('articlesList');
        if (!articlesContainer) return;
        
        let filtered = [];
        
        if (type === 'category') {
            filtered = BlogState.articles.filter(article => 
                article.category.toLowerCase() === value.toLowerCase()
            );
        } else if (type === 'tag') {
            filtered = BlogState.articles.filter(article => 
                article.tags.some(tag => tag.toLowerCase().includes(value))
            );
        }
        
        // Add loading state
        articlesContainer.innerHTML = '<div class="loading-spinner"></div>';
        
        // Simulate loading delay for smooth UX
        setTimeout(() => {
            articlesContainer.innerHTML = filtered.length > 0 
                ? filtered.map(createArticlePreview).join('')
                : '<p class="text-center text-gray-500">No articles found for this filter.</p>';
            
            // Re-setup animations for new content
            setupAnimations();
        }, 300);
    }
    
    showAllArticles() {
        const articlesContainer = document.getElementById('articlesList');
        if (!articlesContainer) return;
        
        const allArticles = BlogState.articles
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        
        articlesContainer.innerHTML = allArticles.map(createArticlePreview).join('');
        setupAnimations();
    }
}

// Auto-initialize on blog page
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('articlesList')) {
        new BlogManager();
    }
});

// Helper function for animations (shared with main.js)
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
            if (!el.classList.contains('fade-in')) {
                observer.observe(el);
            }
        });
    };
    
    setTimeout(observeElements, 100);
}