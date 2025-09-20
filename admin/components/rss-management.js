/**
 * RSS源管理模块组件
 * 包含RSS源列表、添加、编辑等功能
 */

/**
 * RSS源管理页面配置
 */
function getRssSourcesPageConfig() {
    return createCrudPageConfig(
        'RSS源管理',
        {
            statisticsApi: '/admin/simple-rss/statistics',
            listApi: '/admin/simple-rss/sources'
        },
        [
            {
                name: 'id',
                label: 'ID',
                type: 'text',
                sortable: true,
                width: 80,
                fixed: 'left'
            },
            {
                name: 'name',
                label: '源名称',
                type: 'text',
                searchable: true,
                sortable: true
            },
            {
                name: 'url',
                label: 'RSS链接',
                type: 'text',
                searchable: true
            },
            {
                name: 'category',
                label: '分类',
                type: 'text',
                searchable: true
            },
            {
                name: 'status',
                label: '状态',
                type: 'mapping',
                map: {
                    'active': '<span class="label label-success">活跃</span>',
                    'inactive': '<span class="label label-danger">禁用</span>',
                    'error': '<span class="label label-warning">错误</span>'
                }
            },
            {
                name: 'lastFetchAt',
                label: '最后获取',
                type: 'datetime',
                format: 'YYYY-MM-DD HH:mm:ss',
                width: 150
            },
            {
                name: 'createdAt',
                label: '创建时间',
                type: 'datetime',
                format: 'YYYY-MM-DD HH:mm:ss',
                width: 150
            },
            {
                type: 'operation',
                label: '操作',
                width: 280,
                buttons: [
                    {
                        type: 'button', 
                        label: '', 
                        icon: 'fa fa-eye', 
                        tooltip: '查看详情', 
                        level: 'link', 
                        actionType: 'dialog',
                        dialog: {
                            title: 'RSS源详情',
                            size: 'lg',
                            body: {
                                type: 'form',
                                api: {
                                    method: 'get',
                                    url: '/admin/simple-rss/sources/${id}',
                                    headers: {
                                        'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
                                    }
                                },
                                body: [
                                    {
                                        type: 'static',
                                        name: 'id',
                                        label: 'ID'
                                    },
                                    {
                                        type: 'static',
                                        name: 'name',
                                        label: '源名称'
                                    },
                                    {
                                        type: 'static',
                                        name: 'url',
                                        label: 'RSS链接'
                                    },
                                    {
                                        type: 'static',
                                        name: 'description',
                                        label: '描述'
                                    },
                                    {
                                        type: 'static',
                                        name: 'isPublic',
                                        label: '公开状态',
                                        tpl: '${isPublic ? "公开" : "私有"}'
                                    },
                                    {
                                        type: 'static',
                                        name: 'status',
                                        label: '状态',
                                        tpl: '${status === "active" ? "活跃" : "非活跃"}'
                                    },
                                    {
                                        type: 'static',
                                        name: 'fetchFailureCount',
                                        label: '失败次数'
                                    },
                                    {
                                        type: 'static',
                                        name: 'lastFetchedAt',
                                        label: '最后获取时间'
                                    },
                                    {
                                        type: 'static',
                                        name: 'createdAt',
                                        label: '创建时间'
                                    }
                                ]
                            }
                        }
                    },
                    {
                        type: 'button', 
                        label: '', 
                        icon: 'fa fa-edit', 
                        tooltip: '编辑', 
                        level: 'link', 
                        actionType: 'dialog',
                        dialog: getRssSourceEditDialogConfig()
                    },
                    {
                        type: 'button', 
                        label: '', 
                        icon: 'fa fa-plug', 
                        tooltip: '测试连接', 
                        level: 'link', 
                        actionType: 'ajax',
                        confirmText: '确定要测试该RSS源的连接吗？',
                        api: {
                            method: 'post',
                            url: '/admin/simple-rss/sources/${id}/test',
                            headers: {
                                'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
                            }
                        }
                    },
                    {
                        type: 'button', 
                        label: '', 
                        icon: 'fa fa-refresh', 
                        tooltip: '手动获取', 
                        level: 'link', 
                        actionType: 'ajax',
                        confirmText: '确定要立即获取该RSS源的内容吗？',
                        api: {
                            method: 'post',
                            url: '/sources/${id}/trigger-fetch',
                            headers: {
                                'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
                            }
                        }
                    },
                    {
                        type: 'button', 
                        label: '', 
                        icon: 'fa fa-undo', 
                        tooltip: '重置失败计数', 
                        level: 'link', 
                        actionType: 'ajax',
                        confirmText: '确定要重置该RSS源的失败计数吗？',
                        api: {
                            method: 'post',
                            url: '/admin/simple-rss/sources/${id}/reset-failures',
                            headers: {
                                'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
                            }
                        }
                    },
                    {
                        type: 'button', 
                        label: '', 
                        icon: 'fa fa-trash', 
                        tooltip: '删除', 
                        level: 'link', 
                        actionType: 'ajax',
                        confirmText: '确定要删除该RSS源吗？删除后将无法恢复，相关数据也会被清理。',
                        api: {
                            method: 'delete',
                            url: '/admin/simple-rss/sources/${id}',
                            headers: {
                                'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
                            }
                        }
                    }
                ]
            }
        ],
        {
            perPage: 20,
            pageField: 'page',
            perPageField: 'limit',
            mode: 'table',
            syncLocation: false,
            headerToolbar: [
                {
                    type: 'columns-toggler',
                    align: 'left'
                },
                {
                    type: 'reload',
                    align: 'right'
                },
                {
                    type: 'button',
                    icon: 'fa fa-plus',
                    label: '添加RSS源',
                    actionType: 'dialog',
                    dialog: getRssSourceCreateDialogConfig(),
                    align: 'right'
                }
            ],
            footerToolbar: [
                'statistics',
                'pagination'
            ]
        }
    );
}

/**
 * RSS源编辑对话框配置
 */
function getRssSourceEditDialogConfig() {
    return {
        title: '编辑RSS源',
        size: 'md',
        body: {
            type: 'form',
            api: {
                method: 'put',
                url: '/admin/simple-rss/sources/${id}',
                headers: {
                    'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
                }
            },
            body: [
                {
                    type: 'input-text',
                    name: 'name',
                    label: '源名称',
                    required: true,
                    maxLength: 100
                },
                {
                    type: 'input-url',
                    name: 'url',
                    label: 'RSS链接',
                    required: true,
                    validations: {
                        isUrl: true
                    }
                },
                {
                    type: 'textarea',
                    name: 'description',
                    label: '描述',
                    maxLength: 500
                },
                {
                    type: 'select',
                    name: 'isPublic',
                    label: '公开状态',
                    options: [
                        { label: '公开', value: true },
                        { label: '私有', value: false }
                    ]
                }
            ]
        }
    };
}

/**
 * RSS源创建对话框配置
 */
function getRssSourceCreateDialogConfig() {
    return {
        title: '添加RSS源',
        size: 'md',
        body: {
            type: 'form',
            api: {
                method: 'post',
                url: '/admin/simple-rss/sources',
                headers: {
                    'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
                }
            },
            body: [
                {
                    type: 'input-text',
                    name: 'name',
                    label: '源名称',
                    required: true,
                    maxLength: 100,
                    placeholder: '请输入RSS源名称'
                },
                {
                    type: 'input-url',
                    name: 'url',
                    label: 'RSS链接',
                    required: true,
                    validations: {
                        isUrl: true
                    },
                    placeholder: '请输入RSS源链接'
                },
                {
                    type: 'textarea',
                    name: 'description',
                    label: '描述',
                    maxLength: 500,
                    placeholder: '请输入RSS源描述'
                },
                {
                    type: 'select',
                    name: 'isPublic',
                    label: '公开状态',
                    value: false,
                    options: [
                        { label: '公开', value: true },
                        { label: '私有', value: false }
                    ]
                }
            ]
        }
    };
}
