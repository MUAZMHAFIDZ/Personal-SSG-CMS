// Article page functionality
class ArticleManager {
    constructor() {
        this.quill = null;
        this.currentArticle = null;
        this.init();
    }
    
    async init() {
        await BlogState.loadArticles();
        this.loadArticle();
        this.setupQuillEditor();
        this.generateTableOfContents();
        this.setupShareButtons();
        this.loadRecommendedArticles();
    }
    
    loadArticle() {
        const urlParams = new URLSearchParams(window.location.search);
        const slug = urlParams.get('slug');
        
        if (!slug) {
            window.location.href = 'blog.html';
            return;
        }
        
        this.currentArticle = BlogState.getArticleBySlug(slug);
        
        if (!this.currentArticle) {
            window.location.href = 'blog.html';
            return;
        }
        
        this.renderArticleHeader();
        document.title = `${this.currentArticle.title} - BlogSphere`;
    }
    
    renderArticleHeader() {
        const headerContainer = document.getElementById('articleHeader');
        if (!headerContainer || !this.currentArticle) return;
        
        headerContainer.innerHTML = `
            <h1 class="article-title">${this.currentArticle.title}</h1>
            <div class="article-meta">
                <span class="post-category">${this.currentArticle.category}</span>
                <span class="post-date">${formatDate(this.currentArticle.date)}</span>
                <span class="read-time">5 min read</span>
            </div>
            <img src="${this.currentArticle.image}" alt="${this.currentArticle.title}" class="article-image">
        `;
    }
    
    setupQuillEditor() {
        const editorContainer = document.getElementById('articleContent');
        if (!editorContainer || !this.currentArticle) return;
        
        this.quill = new Quill('#articleContent', {
            theme: 'snow',
            readOnly: true,
            modules: {
                toolbar: false
            }
        });
        
        // Set content
        this.quill.root.innerHTML = this.currentArticle.content;
        
        // Render tags
        const tagsContainer = document.getElementById('articleTags');
        if (tagsContainer) {
            tagsContainer.innerHTML = this.currentArticle.tags
                .map(tag => `<span class="tag">${tag}</span>`).join('');
        }
    }
    
    generateTableOfContents() {
        const tocContainer = document.getElementById('tableOfContents');
        if (!tocContainer || !this.quill) return;
        
        setTimeout(() => {
            const headings = this.quill.root.querySelectorAll('h2, h3');
            
            if (headings.length === 0) {
                tocContainer.innerHTML = '<p class="text-gray-500">No headings found</p>';
                return;
            }
            
            const tocList = Array.from(headings).map((heading, index) => {
                const id = `heading-${index}`;
                heading.id = id;
                
                const level = heading.tagName.toLowerCase() === 'h2' ? '' : 'pl-4';
                
                return `
                    <a href="#${id}" class="toc-link ${level}">${heading.textContent}</a>
                `;
            }).join('');
            
            tocContainer.innerHTML = tocList;
            
            // Smooth scroll for TOC links
            tocContainer.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const target = document.querySelector(e.target.getAttribute('href'));
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth' });
                    }
                });
            });
        }, 100);
    }
    
    setupShareButtons() {
        const shareButtons = document.querySelectorAll('.share-btn');
        const currentUrl = window.location.href;
        const title = this.currentArticle?.title || 'Check out this article';
        
        shareButtons.forEach(button => {
            button.addEventListener('click', () => {
                const platform = button.textContent.toLowerCase();
                
                if (platform.includes('twitter')) {
                    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(currentUrl)}`);
                } else if (platform.includes('facebook')) {
                    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl)}`);
                } else if (platform.includes('linkedin')) {
                    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(currentUrl)}`);
                } else if (platform.includes('copy')) {
                    navigator.clipboard.writeText(currentUrl).then(() => {
                        button.innerHTML = '✓ Copied!';
                        setTimeout(() => {
                            button.innerHTML = '📋 Copy Link';
                        }, 2000);
                    });
                }
            });
        });
    }
    
    loadRecommendedArticles() {
        const recommendedContainer = document.getElementById('recommendedPosts');
        if (!recommendedContainer || !this.currentArticle) return;
        
        const recommended = BlogState.getRecommendedArticles(this.currentArticle.id);
        recommendedContainer.innerHTML = recommended.map(createPostCard).join('');
    }
}

// Auto-initialize on article page
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('articleContent')) {
        new ArticleManager();
    }
});