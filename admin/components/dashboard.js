/**
 * 首页组件
 * 显示系统概览和统计信息
 */

/**
 * 首页配置
 */
function resolveDashboardBackendUrl(path) {
    if (typeof window !== 'undefined' && typeof window.buildAdminBackendUrl === 'function') {
        return window.buildAdminBackendUrl(path);
    }
    return path;
}

function getHomePageConfig() {
    const dashboardBody = {
        type: 'service',
        api: {
            method: 'get',
            url: resolveDashboardBackendUrl('/admin/dashboard/statistics'),
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
                                tpl: '${totalUsers || 0}',
                                className: 'h2'
                            }
                        }
                    },
                    {
                        md: 3,
                        body: {
                            type: 'panel',
                            title: 'RSS源数量',
                            body: {
                                type: 'tpl',
                                tpl: '${totalSources || 0}',
                                className: 'h2'
                            }
                        }
                    },
                    {
                        md: 3,
                        body: {
                            type: 'panel',
                            title: '今日处理',
                            body: {
                                type: 'tpl',
                                tpl: '${processedToday || 0}',
                                className: 'h2'
                            }
                        }
                    },
                    {
                        md: 3,
                        body: {
                            type: 'panel',
                            title: '系统状态',
                            body: {
                                type: 'tpl',
                                tpl: '${systemStatus || "正常"}',
                                className: 'h2 text-success'
                            }
                        }
                    }
                ]
            },
            {
                type: 'divider'
            },
            {
                type: 'grid',
                columns: [
                    {
                        md: 6,
                        body: {
                            type: 'panel',
                            title: '最近用户活动',
                            body: {
                                type: 'service',
                                api: {
                                    method: 'get',
                                    url: resolveDashboardBackendUrl('/admin/users/recent'),
                                    headers: {
                                        'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
                                    },
                                    adaptor: function(payload) {
                                        const users = payload?.data?.users || payload?.users || [];
                                        return {
                                            status: payload?.success === false ? 1 : 0,
                                            msg: payload?.error || '',
                                            data: {
                                                items: users
                                            }
                                        };
                                    }
                                },
                                body: {
                                    type: 'table',
                                    source: '${items}',
                                    placeholder: '暂无最近活动',
                                    columns: [
                                        {
                                            name: 'email',
                                            label: '用户'
                                        },
                                        {
                                            name: 'lastLoginAt',
                                            label: '最后登录',
                                            type: 'datetime',
                                            format: 'MM-DD HH:mm'
                                        },
                                        {
                                            name: 'status',
                                            label: '状态',
                                            type: 'mapping',
                                            map: {
                                                'active': '<span class="label label-success">正常</span>',
                                                'inactive': '<span class="label label-danger">禁用</span>'
                                            }
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    {
                        md: 6,
                        body: {
                            type: 'panel',
                            title: '系统日志',
                            body: {
                                type: 'service',
                                api: {
                                    method: 'get',
                                    url: resolveDashboardBackendUrl('/admin/system/logs'),
                                    headers: {
                                        'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
                                    },
                                    adaptor: function(payload) {
                                        const logs = payload?.data?.logs || payload?.logs || [];
                                        return {
                                            status: payload?.success === false ? 1 : 0,
                                            msg: payload?.error || '',
                                            data: {
                                                items: logs
                                            }
                                        };
                                    }
                                },
                                body: {
                                    type: 'table',
                                    source: '${items}',
                                    placeholder: '暂无系统日志',
                                    columns: [
                                        {
                                            name: 'level',
                                            label: '级别',
                                            type: 'mapping',
                                            map: {
                                                'info': '<span class="label label-info">信息</span>',
                                                'warning': '<span class="label label-warning">警告</span>',
                                                'error': '<span class="label label-danger">错误</span>'
                                            }
                                        },
                                        {
                                            name: 'message',
                                            label: '消息'
                                        },
                                        {
                                            name: 'createdAt',
                                            label: '时间',
                                            type: 'datetime',
                                            format: 'MM-DD HH:mm'
                                        }
                                    ]
                                }
                            }
                        }
                    }
                ]
            }
        ]
    };
    
    // 使用导航布局
    if (typeof NavComponents !== 'undefined' && NavComponents.createNavLayout) {
        return NavComponents.createNavLayout({
            title: '墨香蒸馏管理后台',
            body: dashboardBody
        });
    } else {
        // 如果导航组件不可用，使用简单布局
        return {
            type: 'page',
            title: '墨香蒸馏管理后台',
            body: dashboardBody
        };
    }
}

// 导出函数
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getHomePageConfig
    };
} else if (typeof window !== 'undefined') {
    window.DashboardComponents = {
        getHomePageConfig
    };
}
