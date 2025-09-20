const resolveMonitorBackendUrl = (path) => {
    if (typeof window !== 'undefined' && typeof window.buildAdminBackendUrl === 'function') {
        return window.buildAdminBackendUrl(path);
    }
    return path;
};

// 系统状态监控组件
class SystemMonitor {
    constructor() {
        this.refreshInterval = null;
        this.init();
    }

    init() {
        this.createMonitorPage();
        this.startAutoRefresh();
    }

    createMonitorPage() {
        const monitorSchema = {
            type: 'page',
            title: '系统状态监控',
            body: [
                {
                    type: 'grid',
                    columns: [
                        {
                            md: 6,
                            body: {
                                type: 'service',
                                api: {
                                    url: resolveMonitorBackendUrl('/api/admin/system/status'),
                                    method: 'get',
                                    adaptor: function(payload) {
                                        return {
                                            status: payload.status === 'healthy' ? 0 : 1,
                                            msg: payload.status === 'healthy' ? '系统正常' : '系统异常',
                                            data: payload
                                        };
                                    }
                                },
                                body: [
                                    {
                                        type: 'tpl',
                                        tpl: '系统总览',
                                        wrapperComponent: 'h2'
                                    },
                                    {
                                        type: 'status',
                                        name: 'status'
                                    },
                                    {
                                        type: 'tpl',
                                        tpl: '${msg}'
                                    },
                                    {
                                        type: 'divider'
                                    },
                                    {
                                        type: 'tpl',
                                        tpl: '检查时间: ${data.checkTime}'
                                    },
                                    {
                                        type: 'tpl',
                                        tpl: '运行时间: ${data.uptime}'
                                    }
                                ]
                            }
                        },
                        {
                            md: 6,
                            body: {
                                type: 'service',
                                api: {
                                    url: resolveMonitorBackendUrl('/api/admin/queue/stats'),
                                    method: 'get',
                                    adaptor: function(payload) {
                                        return {
                                            status: 0,
                                            msg: '队列统计',
                                            data: payload
                                        };
                                    }
                                },
                                body: [
                                    {
                                        type: 'tpl',
                                        tpl: '队列统计',
                                        wrapperComponent: 'h2'
                                    },
                                    {
                                        type: 'cards',
                                        cards: [
                                            {
                                                title: 'RSS处理队列',
                                                body: {
                                                    type: 'tpl',
                                                    tpl: '待处理: ${data.rssQueue.pending}<br/>处理中: ${data.rssQueue.processing}<br/>失败: ${data.rssQueue.failed}'
                                                }
                                            },
                                            {
                                                title: 'AI处理队列',
                                                body: {
                                                    type: 'tpl',
                                                    tpl: '待处理: ${data.aiQueue.pending}<br/>处理中: ${data.aiQueue.processing}<br/>失败: ${data.aiQueue.failed}'
                                                }
                                            },
                                            {
                                                title: '内容分发队列',
                                                body: {
                                                    type: 'tpl',
                                                    tpl: '待处理: ${data.distributionQueue.pending}<br/>处理中: ${data.distributionQueue.processing}<br/>失败: ${data.distributionQueue.failed}'
                                                }
                                            }
                                        ]
                                    }
                                ]
                            }
                        }
                    ]
                },
                {
                    type: 'divider'
                },
                {
                    type: 'tpl',
                    tpl: '队列详情',
                    wrapperComponent: 'h2'
                },
                {
                    type: 'tabs',
                    tabs: [
                        {
                            title: 'RSS抓取队列',
                            body: this.createQueueDetailTable('rss')
                        },
                        {
                            title: 'AI处理队列',
                            body: this.createQueueDetailTable('ai')
                        },
                        {
                            title: '内容分发队列',
                            body: this.createQueueDetailTable('distribution')
                        },
                        {
                            title: '存储优化队列',
                            body: this.createQueueDetailTable('storage')
                        }
                    ]
                },
                {
                    type: 'divider'
                },
                {
                    type: 'tpl',
                    tpl: '操作控制',
                    wrapperComponent: 'h2'
                },
                {
                    type: 'grid',
                    columns: [
                        {
                            md: 3,
                            body: {
                                type: 'action',
                                label: '手动触发RSS抓取',
                                level: 'primary',
                                actionType: 'ajax',
                                api: {
                                    method: 'post',
                                    url: resolveMonitorBackendUrl('/api/admin/system/rss/trigger-fetch')
                                },
                                confirmText: '确定要手动触发RSS抓取吗？'
                            }
                        },
                        {
                            md: 3,
                            body: {
                                type: 'action',
                                label: '刷新队列状态',
                                level: 'info',
                                actionType: 'reload',
                                target: 'window'
                            }
                        },
                        {
                            md: 3,
                            body: {
                                type: 'action',
                                label: '清理失败任务',
                                level: 'warning',
                                actionType: 'ajax',
                                api: {
                                    method: 'post',
                                    url: resolveMonitorBackendUrl('/api/admin/system/queue/cleanup')
                                },
                                confirmText: '确定要清理所有失败的任务吗？'
                            }
                        },
                        {
                            md: 3,
                            body: {
                                type: 'action',
                                label: '系统日志',
                                level: 'default',
                                actionType: 'dialog',
                                dialog: {
                                    title: '系统日志',
                                    body: {
                                        type: 'service',
                                        api: {
                                            url: resolveMonitorBackendUrl('/api/admin/system/logs'),
                                            method: 'get'
                                        },
                                        body: [
                                            {
                                                type: 'table',
                                                name: 'logs',
                                                columns: [
                                                    {
                                                        name: 'timestamp',
                                                        label: '时间',
                                                        type: 'datetime',
                                                        format: 'YYYY-MM-DD HH:mm:ss'
                                                    },
                                                    {
                                                        name: 'level',
                                                        label: '级别',
                                                        type: 'mapping',
                                                        map: {
                                                            'INFO': 'success',
                                                            'WARN': 'warning',
                                                            'ERROR': 'danger'
                                                        }
                                                    },
                                                    {
                                                        name: 'message',
                                                        label: '消息'
                                                    },
                                                    {
                                                        name: 'source',
                                                        label: '来源'
                                                    }
                                                ]
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

        // 返回监控页面schema
        return monitorSchema;
    }

    createQueueDetailTable(queueType) {
        return {
            type: 'service',
            api: {
                url: resolveMonitorBackendUrl(`/api/admin/system/queue/${queueType}/details`),
                method: 'get'
            },
            body: [
                {
                    type: 'table',
                    name: 'items',
                    columns: [
                        {
                            name: 'id',
                            label: 'ID',
                            type: 'text'
                        },
                        {
                            name: 'status',
                            label: '状态',
                            type: 'mapping',
                            map: {
                                'pending': 'warning',
                                'processing': 'info',
                                'completed': 'success',
                                'failed': 'danger'
                            }
                        },
                        {
                            name: 'createdAt',
                            label: '创建时间',
                            type: 'datetime',
                            format: 'YYYY-MM-DD HH:mm:ss'
                        },
                        {
                            name: 'processingTime',
                            label: '处理时长(ms)',
                            type: 'text'
                        },
                        {
                            name: 'retryCount',
                            label: '重试次数',
                            type: 'text'
                        },
                        {
                            name: 'errorMessage',
                            label: '错误信息',
                            type: 'text'
                        },
                        {
                            type: 'operation',
                            label: '操作',
                            buttons: [
                                {
                                    label: '重试',
                                    type: 'button',
                                    level: 'primary',
                                    actionType: 'ajax',
                                    api: {
                                        method: 'post',
                                        url: resolveMonitorBackendUrl(`/api/admin/system/queue/${queueType}/retry/${'$id'}`)
                                    },
                                    visibleOn: '${status} === "failed"'
                                },
                                {
                                    label: '删除',
                                    type: 'button',
                                    level: 'danger',
                                    actionType: 'ajax',
                                    api: {
                                        method: 'delete',
                                        url: resolveMonitorBackendUrl(`/api/admin/system/queue/${queueType}/item/${'$id'}`)
                                    },
                                    confirmText: '确定要删除这个任务吗？'
                                }
                            ]
                        }
                    ]
                }
            ]
        };
    }

    renderMonitorPage(schema) {
        const root = document.getElementById('root');
        if (root && amis) {
            amis.embed(root, schema);
        }
    }

    startAutoRefresh() {
        // 每30秒自动刷新数据
        this.refreshInterval = setInterval(() => {
            if (window.amis && window.amisScoped) {
                window.amisScoped.reload();
            }
        }, 30000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    if (!window.systemMonitor) {
        window.systemMonitor = new SystemMonitor();
    }
});

// 导出组件
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SystemMonitor;
} else if (typeof window !== 'undefined') {
    // 直接导出schema创建函数
    window.SystemMonitor = {
        createMonitorPage: function() {
            // 返回系统监控页面的完整schema
            return {
                type: 'page',
                title: '系统状态监控',
                body: [
                    {
                        type: 'grid',
                        columns: [
                            {
                                md: 6,
                                body: {
                                    type: 'service',
                                    api: {
                                        url: resolveMonitorBackendUrl('/api/admin/system/status'),
                                        method: 'get',
                                        adaptor: function(payload) {
                                            return {
                                                status: payload.status === 'healthy' ? 0 : 1,
                                                msg: payload.status === 'healthy' ? '系统正常' : '系统异常',
                                                data: payload
                                            };
                                        }
                                    },
                                    body: [
                                        {
                                            type: 'tpl',
                                            tpl: '系统总览',
                                            wrapperComponent: 'h2'
                                        },
                                        {
                                            type: 'status',
                                            name: 'status'
                                        },
                                        {
                                            type: 'tpl',
                                            tpl: '${msg}'
                                        },
                                        {
                                            type: 'grid',
                                            columns: [
                                                {
                                                    md: 6,
                                                    body: {
                                                        type: 'tpl',
                                                        tpl: 'RSS源状态',
                                                        wrapperComponent: 'h3'
                                                    }
                                                },
                                                {
                                                    md: 6,
                                                    body: {
                                                        type: 'tpl',
                                                        tpl: '内容处理状态',
                                                        wrapperComponent: 'h3'
                                                    }
                                                }
                                            ]
                                        },
                                        {
                                            type: 'grid',
                                            columns: [
                                                {
                                                    md: 6,
                                                    body: {
                                                        type: 'tpl',
                                                        tpl: '总数: ${data.data.components.rssSources.total}',
                                                        visibleOn: 'data.data.components.rssSources'
                                                    }
                                                },
                                                {
                                                    md: 6,
                                                    body: {
                                                        type: 'tpl',
                                                        tpl: '活跃: ${data.data.components.rssSources.active}',
                                                        visibleOn: 'data.data.components.rssSources'
                                                    }
                                                }
                                            ]
                                        },
                                        {
                                            type: 'grid',
                                            columns: [
                                                {
                                                    md: 6,
                                                    body: {
                                                        type: 'tpl',
                                                        tpl: '已处理: ${data.data.components.contentProcessing.processed}',
                                                        visibleOn: 'data.data.components.contentProcessing'
                                                    }
                                                },
                                                {
                                                    md: 6,
                                                    body: {
                                                        type: 'tpl',
                                                        tpl: '成功率: ${data.data.components.contentProcessing.successRate}',
                                                        visibleOn: 'data.data.components.contentProcessing'
                                                    }
                                                }
                                            ]
                                        }
                                    ]
                                }
                            },
                            {
                                md: 6,
                                body: {
                                    type: 'service',
                                    api: {
                                        url: resolveMonitorBackendUrl('/api/admin/system/queue/stats'),
                                        method: 'get'
                                    },
                                    body: [
                                        {
                                            type: 'tpl',
                                            tpl: '队列统计',
                                            wrapperComponent: 'h2'
                                        },
                                        {
                                            type: 'grid',
                                            columns: [
                                                {
                                                    md: 6,
                                                    body: {
                                                        type: 'tpl',
                                                        tpl: 'RSS队列'
                                                    }
                                                },
                                                {
                                                    md: 6,
                                                    body: {
                                                        type: 'tpl',
                                                        tpl: 'AI队列'
                                                    }
                                                }
                                            ]
                                        },
                                        {
                                            type: 'grid',
                                            columns: [
                                                {
                                                    md: 6,
                                                    body: {
                                                        type: 'tpl',
                                                        tpl: '待处理: ${data.rssQueue.pending}'
                                                    }
                                                },
                                                {
                                                    md: 6,
                                                    body: {
                                                        type: 'tpl',
                                                        tpl: '待处理: ${data.aiQueue.pending}'
                                                    }
                                                }
                                            ]
                                        },
                                        {
                                            type: 'grid',
                                            columns: [
                                                {
                                                    md: 6,
                                                    body: {
                                                        type: 'tpl',
                                                        tpl: '处理中: ${data.rssQueue.processing}'
                                                    }
                                                },
                                                {
                                                    md: 6,
                                                    body: {
                                                        type: 'tpl',
                                                        tpl: '处理中: ${data.aiQueue.processing}'
                                                    }
                                                }
                                            ]
                                        }
                                    ]
                                }
                            }
                        ]
                    },
                    {
                        type: 'tpl',
                        tpl: '队列详情',
                        wrapperComponent: 'h2'
                    },
                    {
                        type: 'tabs',
                        tabs: [
                            {
                                title: 'RSS队列',
                                body: {
                                    type: 'service',
                                    api: {
                                        url: resolveMonitorBackendUrl('/api/admin/system/queue/rss/details'),
                                        method: 'get'
                                    },
                                    body: [
                                        {
                                            type: 'table',
                                            name: 'items',
                                            columns: [
                                                {
                                                    name: 'id',
                                                    label: 'ID',
                                                    type: 'text'
                                                },
                                                {
                                                    name: 'title',
                                                    label: '标题',
                                                    type: 'text'
                                                },
                                                {
                                                    name: 'status',
                                                    label: '状态',
                                                    type: 'mapping',
                                                    map: {
                                                        'pending': 'warning',
                                                        'processing': 'info',
                                                        'completed': 'success',
                                                        'failed': 'danger'
                                                    }
                                                },
                                                {
                                                    name: 'createdAt',
                                                    label: '创建时间',
                                                    type: 'datetime',
                                                    format: 'YYYY-MM-DD HH:mm:ss'
                                                }
                                            ]
                                        }
                                    ]
                                }
                            },
                            {
                                title: 'AI队列',
                                body: {
                                    type: 'service',
                                    api: {
                                        url: resolveMonitorBackendUrl('/api/admin/system/queue/ai/details'),
                                        method: 'get'
                                    },
                                    body: [
                                        {
                                            type: 'table',
                                            name: 'items',
                                            columns: [
                                                {
                                                    name: 'id',
                                                    label: 'ID',
                                                    type: 'text'
                                                },
                                                {
                                                    name: 'title',
                                                    label: '标题',
                                                    type: 'text'
                                                },
                                                {
                                                    name: 'status',
                                                    label: '状态',
                                                    type: 'mapping',
                                                    map: {
                                                        'pending': 'warning',
                                                        'processing': 'info',
                                                        'completed': 'success',
                                                        'failed': 'danger'
                                                    }
                                                },
                                                {
                                                    name: 'createdAt',
                                                    label: '创建时间',
                                                    type: 'datetime',
                                                    format: 'YYYY-MM-DD HH:mm:ss'
                                                }
                                            ]
                                        }
                                    ]
                                }
                            }
                        ]
                    },
                    {
                        type: 'tpl',
                        tpl: '操作控制',
                        wrapperComponent: 'h2'
                    },
                    {
                        type: 'grid',
                        columns: [
                            {
                                md: 3,
                                body: {
                                    type: 'action',
                                    label: '手动触发RSS抓取',
                                    level: 'primary',
                                    actionType: 'ajax',
                                    api: {
                                        method: 'post',
                                        url: resolveMonitorBackendUrl('/api/admin/system/rss/trigger-fetch')
                                    },
                                    confirmText: '确定要手动触发RSS抓取吗？'
                                }
                            },
                            {
                                md: 3,
                                body: {
                                    type: 'action',
                                    label: '刷新队列状态',
                                    level: 'info',
                                    actionType: 'reload',
                                    target: 'window'
                                }
                            },
                            {
                                md: 3,
                                body: {
                                    type: 'action',
                                    label: '清理失败任务',
                                    level: 'warning',
                                    actionType: 'ajax',
                                    api: {
                                        method: 'post',
                                        url: resolveMonitorBackendUrl('/api/admin/system/queue/cleanup')
                                    },
                                    confirmText: '确定要清理所有失败的任务吗？'
                                }
                            },
                            {
                                md: 3,
                                body: {
                                    type: 'action',
                                    label: '系统日志',
                                    level: 'default',
                                    actionType: 'dialog',
                                    dialog: {
                                        title: '系统日志',
                                        body: {
                                            type: 'service',
                                            api: {
                                                url: resolveMonitorBackendUrl('/api/admin/system/logs'),
                                                method: 'get'
                                            },
                                            body: [
                                                {
                                                    type: 'table',
                                                    name: 'logs',
                                                    columns: [
                                                        {
                                                            name: 'timestamp',
                                                            label: '时间',
                                                            type: 'datetime',
                                                            format: 'YYYY-MM-DD HH:mm:ss'
                                                        },
                                                        {
                                                            name: 'level',
                                                            label: '级别',
                                                            type: 'mapping',
                                                            map: {
                                                                'INFO': 'success',
                                                                'WARN': 'warning',
                                                                'ERROR': 'danger'
                                                            }
                                                        },
                                                        {
                                                            name: 'message',
                                                            label: '消息'
                                                        },
                                                        {
                                                            name: 'source',
                                                            label: '来源'
                                                        }
                                                    ]
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
        }
    };
}
