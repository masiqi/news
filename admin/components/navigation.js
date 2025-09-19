/**
 * 导航组件
 * 提供侧边栏导航功能
 */

/**
 * 获取导航配置
 */
function getNavigationConfig() {
    const current = (typeof window !== 'undefined' && window.location && window.location.hash) ? window.location.hash : '#/home';
    const links = [
        { label: '首页', to: '#/home', icon: 'fa fa-home' },
        { label: '用户管理', to: '#/users', icon: 'fa fa-users' },
        { label: 'RSS源管理', to: '#/sources', icon: 'fa fa-rss' },
        { label: 'Markdown管理', to: '#/markdown', icon: 'fa fa-file-text' },
        { label: '内容管理', to: '#/content', icon: 'fa fa-newspaper-o' }
    ].map(item => ({ ...item, active: item.to === current }));

    return {
        type: 'nav',
        stacked: true,
        mode: 'inline',
        className: 'admin-nav',
        style: { width: '220px' },
        links,
        // 移除调试用 toast，点击后仅执行跳转
        onEvent: {
            click: {
                actions: [
                    {
                        actionType: 'custom',
                        script: 'window.location.hash = event.data.item.to'
                    }
                ]
            }
        }
    };
}

/**
 * 创建带导航的页面布局
 */
function createNavLayout(pageConfig) {
    return {
        type: 'page',
        title: pageConfig.title || 'AI资讯平台管理后台',
        asideResizor: true,
        aside: [
            {
                type: 'tpl',
                tpl: '<div class="logo-wrapper"><div class="logo">AI资讯平台</div></div>',
                className: 'logo-wrapper'
            },
            getNavigationConfig()
        ],
        body: pageConfig.body,
        className: 'nav-page',
        regions: ['body', 'header', 'footer', 'aside'],
        asideClassName: 'w-48 bg-gray-100'
    };
}

/**
 * 导航工具函数
 */
const NavigationUtils = {
    /**
     * 激活当前菜单项
     */
    setActiveMenuItem: function(navigationConfig, currentPath) {
        function processLinks(links) {
            links.forEach(link => {
                link.active = (link.to === currentPath);
                if (link.children) {
                    processLinks(link.children);
                }
            });
        }
        
        const config = JSON.parse(JSON.stringify(navigationConfig));
        processLinks(config.links);
        return config;
    },
    
    /**
     * 获取面包屑导航
     */
    getBreadcrumbs: function(navigationConfig, currentPath) {
        const breadcrumbs = [];
        
        function findPath(links, path, currentTrail = []) {
            for (const link of links) {
                const trail = [...currentTrail, link];
                if (link.to === path) {
                    return trail;
                }
                if (link.children) {
                    const found = findPath(link.children, path, trail);
                    if (found) {
                        return found;
                    }
                }
            }
            return null;
        }
        
        const trail = findPath(navigationConfig.links, currentPath);
        if (trail) {
            trail.forEach(item => {
                breadcrumbs.push({
                    label: item.label,
                    to: item.to
                });
            });
        }
        
        return breadcrumbs;
    }
};

// 导出组件和工具函数
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getNavigationConfig,
        createNavLayout,
        NavigationUtils
    };
} else if (typeof window !== 'undefined') {
    window.NavComponents = {
        getNavigationConfig,
        createNavLayout,
        NavigationUtils
    };
}
