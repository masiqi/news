/**
 * 基础页面布局组件
 * 提供统一的页面结构，包括头部导航和主要内容区域
 */

function createBasePageConfig(title, bodyContent, showHeader = true) {
    return {
        type: 'page',
        title: title,
        body: bodyContent
    };
}

/**
 * 带侧边栏的布局组件
 */
function createSidebarLayout(activePage) {
    return {
        type: 'page',
        title: 'AI资讯平台管理后台',
        body: [
            {
                type: 'wrapper',
                className: 'bg-light',
                body: {
                    type: 'nav',
                    stacked: true,
                    links: [
                        {
                            label: '首页',
                            icon: 'fa fa-home',
                            to: '#/home',
                            active: activePage === '/home'
                        },
                        {
                            label: '用户管理',
                            icon: 'fa fa-users',
                            to: '#/users',
                            active: activePage === '/users'
                        },
                        {
                            label: 'RSS源管理',
                            icon: 'fa fa-rss',
                            to: '#/sources',
                            active: activePage === '/sources'
                        },
                        {
                            label: 'Markdown管理',
                            icon: 'fa fa-file-text',
                            to: '#/markdown',
                            active: activePage === '/markdown'
                        },
                        {
                            label: '内容管理',
                            icon: 'fa fa-content',
                            to: '#/content',
                            active: activePage === '/content'
                        }
                    ]
                }
            }
        ]
    };
}

/**
 * 创建CRUD页面的基础配置
 */
function createCrudPageConfig(title, apiConfig, columnsConfig, actionsConfig = {}) {
    return {
        type: 'page',
        title: title,
        body: {
            type: 'service',
            api: {
                method: 'get',
                url: apiConfig.statisticsApi || '',
                headers: {
                    'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
                }
            },
            body: [
                {
                    type: 'grid',
                    columns: [
                        {
                            md: 3,
                            body: {
                                type: 'panel',
                                title: '总用户数',
                                body: {
                                    type: 'tpl',
                                    tpl: '${totalUsers || 0}'
                                }
                            }
                        },
                        {
                            md: 3,
                            body: {
                                type: 'panel',
                                title: '活跃用户',
                                body: {
                                    type: 'tpl',
                                    tpl: '${activeUsers || 0}'
                                }
                            }
                        },
                        {
                            md: 3,
                            body: {
                                type: 'panel',
                                title: '新增用户(今日)',
                                body: {
                                    type: 'tpl',
                                    tpl: '${newUsersToday || 0}'
                                }
                            }
                        },
                        {
                            md: 3,
                            body: {
                                type: 'panel',
                                title: '异常用户',
                                body: {
                                    type: 'tpl',
                                    tpl: '${riskUsers || 0}'
                                }
                            }
                        }
                    ]
                },
                {
                    type: 'divider'
                },
                {
                    type: 'crud',
                    api: {
                        method: 'get',
                        url: apiConfig.listApi,
                        headers: {
                            'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
                        },
                        adaptor: function(payload, response) {
                            console.log('API原始响应:', response);
                            const data = response.data?.data || response.data || response;
                            console.log('处理后的数据:', data);
                            return {
                                status: 0,
                                msg: '',
                                data: {
                                    items: data.users || data.items || [],
                                    total: data.pagination?.total || data.total || 0
                                }
                            };
                        }
                    },
                    columns: columnsConfig,
                    features: ['filter', 'create', 'update', 'delete'],
                    filter: {
                        title: '搜索条件',
                        submitText: '搜索',
                        controls: [
                            {
                                type: 'text',
                                name: 'keyword',
                                label: '关键词',
                                placeholder: '请输入关键词搜索'
                            },
                            {
                                type: 'select',
                                name: 'status',
                                label: '状态',
                                options: [
                                    { label: '全部', value: '' },
                                    { label: '正常', value: 'active' },
                                    { label: '禁用', value: 'inactive' }
                                ]
                            }
                        ]
                    },
                    ...actionsConfig
                }
            ]
        }
    };
}