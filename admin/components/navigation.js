/**
 * 导航组件
 * 提供侧边栏导航功能
 */

/**
 * 获取导航配置
 */
function getNavigationConfig() {
    return {
        type: 'nav',
        stacked: true,
        mode: 'inline', // 使用内联模式作为侧边栏
        className: 'admin-nav',
        style: {
            width: '220px'
        },
        links: [
            {
                label: '首页',
                to: '/',
                icon: 'fa fa-home',
                active: true
            },
            {
                label: '用户管理',
                icon: 'fa fa-users',
                children: [
                    {
                        label: '用户列表',
                        to: '/users/list',
                        icon: 'fa fa-list'
                    },
                    {
                        label: '用户统计',
                        to: '/users/statistics',
                        icon: 'fa fa-bar-chart'
                    }
                ]
            },
            {
                label: '内容管理',
                icon: 'fa fa-file-text',
                children: [
                    {
                        label: 'RSS源管理',
                        to: '/content/sources',
                        icon: 'fa fa-rss'
                    },
                    {
                        label: '文章管理',
                        to: '/content/articles',
                        icon: 'fa fa-newspaper-o'
                    },
                    {
                        label: '分类管理',
                        to: '/content/categories',
                        icon: 'fa fa-tags'
                    }
                ]
            },
            {
                label: '系统设置',
                icon: 'fa fa-cog',
                children: [
                    {
                        label: '系统统计',
                        to: '/system/statistics',
                        icon: 'fa fa-line-chart'
                    },
                    {
                        label: '日志管理',
                        to: '/system/logs',
                        icon: 'fa fa-file-text-o'
                    },
                    {
                        label: '系统配置',
                        to: '/system/config',
                        icon: 'fa fa-wrench'
                    }
                ]
            }
        ],
        onEvent: {
            click: {
                actions: [
                    {
                        actionType: 'toast',
                        args: {
                            msg: '导航到: ${event.data.item.label}'
                        }
                    }
                ]
            },
            change: {
                actions: [
                    {
                        actionType: 'toast',
                        args: {
                            msg: '切换到: ${event.data.value[0]?.label}'
                        }
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