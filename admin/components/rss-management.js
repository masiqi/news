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
            statisticsApi: '/admin/statistics/overview',
            listApi: '/admin/sources'
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
                width: 120,
                buttons: [
                    {
                        type: 'button',
                        icon: 'fa fa-refresh',
                        tooltip: '手动获取',
                        actionType: 'ajax',
                        confirmText: '确定要立即获取该RSS源的内容吗？',
                        api: {
                            method: 'post',
                            url: '/sources/${id}/trigger-fetch',
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
                url: '/admin/sources/${id}',
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
                    type: 'input-text',
                    name: 'category',
                    label: '分类',
                    maxLength: 50
                },
                {
                    type: 'textarea',
                    name: 'description',
                    label: '描述',
                    maxLength: 500
                },
                {
                    type: 'select',
                    name: 'status',
                    label: '状态',
                    required: true,
                    options: [
                        { label: '活跃', value: 'active' },
                        { label: '禁用', value: 'inactive' }
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
                url: '/admin/sources',
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
                    type: 'input-text',
                    name: 'category',
                    label: '分类',
                    maxLength: 50,
                    placeholder: '请输入分类名称'
                },
                {
                    type: 'textarea',
                    name: 'description',
                    label: '描述',
                    maxLength: 500,
                    placeholder: '请输入RSS源描述'
                }
            ]
        }
    };
}
