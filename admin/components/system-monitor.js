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
                                        const data = payload || {};
                                        const components = data.components || {};
                                        const componentRows = Object.keys(components).map(function(key) {
                                            const info = components[key] || {};
                                            const nameMap = {
                                                rssSources: 'RSS源',
                                                contentProcessing: '内容处理',
                                                recentActivity: '近期活动'
                                            };
                                            const detailParts = [];
                                            Object.keys(info).forEach(function(field) {
                                                if (typeof info[field] === 'number' || typeof info[field] === 'string') {
                                                    if (field !== 'health') {
                                                        detailParts.push(field + ': ' + info[field]);
                                                    }
                                                }
                                            });
                                            return {
                                                key,
                                                name: nameMap[key] || key,
                                                details: detailParts.join('，') || '- ',
                                                health: info.health || 'unknown'
                                            };
                                        });
                                        return {
                                            status: data.status === 'healthy' ? 0 : 0,
                                            data: {
                                                statusText: data.status || 'unknown',
                                                checkTime: data.checkTime,
                                                uptime: data.uptime,
                                                performance: data.performance,
                                                componentRows
                                            }
                                        };
                                    }
                                },
                                body: [
                                    {
                                        type: 'grid',
                                        columns: [
                                            {
                                                md: 4,
                                                body: {
                                                    type: 'tpl',
                                                    tpl: '<div class="text-muted mb-2">系统状态</div><div class="display-6 ${statusText === "healthy" ? "text-success" : statusText === "warning" ? "text-warning" : "text-muted"}">${statusText}</div><div class="text-xs text-muted">检查时间：${checkTime | date:YYYY-MM-DD HH:mm}</div><div class="text-xs text-muted">运行时间：${uptime || "-"}</div>'
                                                }
                                            },
                                            {
                                                md: 8,
                                                body: {
                                                    type: 'table',
                                                    source: '${componentRows}',
                                                    columns: [
                                                        { name: 'name', label: '组件' },
                                                        { name: 'details', label: '详情' },
                                                        {
                                                            name: 'health',
                                                            label: '状态',
                                                            type: 'mapping',
                                                            map: {
                                                                healthy: '<span class="badge badge-success">正常</span>',
                                                                warning: '<span class="badge badge-warning">告警</span>',
                                                                idle: '<span class="badge badge-secondary">空闲</span>',
                                                                unknown: '<span class="badge badge-light">未知</span>'
                                                            }
                                                        }
                                                    ],
                                                    placeholder: '暂无组件数据'
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
                                    method: 'get',
                                    adaptor: function(payload) {
                                        const data = payload || {};
                                        const queues = ['rssQueue', 'aiQueue', 'distributionQueue', 'storageQueue'];
                                        const queueRows = queues.map(function(key) {
                                            const info = data[key] || {};
                                            const nameMap = {
                                                rssQueue: 'RSS队列',
                                                aiQueue: 'AI队列',
                                                distributionQueue: '内容分发',
                                                storageQueue: '存储优化'
                                            };
                                            return {
                                                key,
                                                name: nameMap[key] || key,
                                                pending: info.pending || 0,
                                                processing: info.processing || 0,
                                                failed: info.failed || 0,
                                                total: info.total || 0
                                            };
                                        });
                                        const summary = data.summary || {};
                                        return {
                                            status: 0,
                                            data: {
                                                summary,
                                                queueRows
                                            }
                                        };
                                    }
                                },
                                body: [
                                    {
                                        type: 'grid',
                                        columns: [
                                            {
                                                md: 4,
                                                body: [
                                                    {
                                                        type: 'tpl',
                                                        tpl: '<div class="text-muted mb-1">待处理</div><div class="display-6">${summary.totalPending || 0}</div>'
                                                    },
                                                    {
                                                        type: 'tpl',
                                                        tpl: '<div class="text-muted mb-1">处理中</div><div class="display-6">${summary.totalProcessing || 0}</div>'
                                                    },
                                                    {
                                                        type: 'tpl',
                                                        tpl: '<div class="text-muted mb-1">失败</div><div class="display-6 text-danger">${summary.totalFailed || 0}</div>'
                                                    }
                                                ]
                                            },
                                            {
                                                md: 8,
                                                body: {
                                                    type: 'table',
                                                    source: '${queueRows}',
                                                    columns: [
                                                        { name: 'name', label: '队列' },
                                                        { name: 'pending', label: '待处理' },
                                                        { name: 'processing', label: '处理中' },
                                                        { name: 'failed', label: '失败' },
                                                        { name: 'total', label: '总数' }
                                                    ],
                                                    placeholder: '暂无队列数据'
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
    window.SystemMonitor = {
        createMonitorPage: function() {
            if (!window.systemMonitor) {
                window.systemMonitor = new SystemMonitor();
            }
            return window.systemMonitor.createMonitorPage();
        }
    };
}
