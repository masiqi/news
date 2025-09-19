/**
 * 用户管理模块组件
 * 包含用户列表、用户详情、用户编辑等功能
 */

/**
 * 用户管理页面配置
 */
function getUsersPageConfig() {
    return createCrudPageConfig(
        '用户管理',
        {
            statisticsApi: '/admin/users/statistics',
            listApi: '/admin/users'
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
                name: 'email',
                label: '邮箱',
                type: 'text',
                searchable: true,
                sortable: true
            },
            {
                name: 'status',
                label: '状态',
                type: 'mapping',
                map: {
                    'active': '<span class="label label-success">正常</span>',
                    'inactive': '<span class="label label-danger">禁用</span>'
                }
            },
            {
                name: 'role',
                label: '角色',
                type: 'mapping',
                map: {
                    'user': '<span class="label label-info">用户</span>',
                    'admin': '<span class="label label-warning">管理员</span>'
                }
            },
            {
                name: 'loginCount',
                label: '登录次数',
                type: 'text',
                width: 100
            },
            {
                name: 'lastLoginAt',
                label: '最后登录',
                type: 'datetime',
                format: 'YYYY-MM-DD HH:mm:ss',
                width: 150
            },
            {
                name: 'createdAt',
                label: '注册时间',
                type: 'datetime',
                format: 'YYYY-MM-DD HH:mm:ss',
                width: 150
            },
            {
                type: 'operation',
                label: '操作',
                width: 200,
                buttons: [
                    {
                        type: 'button',
                        icon: 'fa fa-eye',
                        tooltip: '查看详情',
                        actionType: 'dialog',
                        dialog: getUserDetailDialogConfig()
                    },
                    {
                        type: 'button',
                        icon: 'fa fa-edit',
                        tooltip: '编辑用户',
                        actionType: 'dialog',
                        dialog: getUserEditDialogConfig()
                    },
                    {
                        type: 'button',
                        icon: 'fa fa-key',
                        tooltip: '修改密码',
                        actionType: 'dialog',
                        dialog: getPasswordChangeDialogConfig()
                    },
                    {
                        type: 'button',
                        icon: 'fa fa-trash',
                        tooltip: '删除用户',
                        actionType: 'ajax',
                        confirmText: '确定要删除该用户吗？此操作不可恢复！',
                        api: {
                            method: 'delete',
                            url: '/admin/users/${id}',
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
                // 移除 create 按钮，避免 AMIS 6.13 在 crud.toolbar.create 渲染器缺失时用 <code> dump 配置
            ],
            footerToolbar: [
                'statistics',
                'pagination'
            ]
        }
    );
}

/**
 * 用户详情对话框配置
 */
function getUserDetailDialogConfig() {
    return {
        title: '用户详情',
        size: 'md',
        body: {
            type: 'service',
            api: {
                method: 'get',
                url: '/admin/users/${id}',
                headers: {
                    'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
                },
                adaptor: function(payload, response) {
                    const data = response.data?.data || response.data || response;
                    const user = data.user || {};
                    // 扁平化为表单可直接使用的字段
                    return {
                        status: 0,
                        msg: '',
                        data: {
                            id: user.id,
                            email: user.email,
                            status: user.status,
                            role: user.role,
                            loginCount: user.loginCount,
                            lastLoginAt: user.lastLoginAt,
                            registeredIp: user.registeredIp,
                            riskLevel: user.riskLevel
                        }
                    };
                }
            },
            body: {
                type: 'form',
                static: true,
                body: [
                    {
                        type: 'tabs',
                        tabs: [
                            {
                                title: '基本信息',
                                body: {
                                    type: 'grid',
                                    columns: [
                                        {
                                            md: 6,
                                            body: [
                                                {
                                                    type: 'static',
                                                    name: 'id',
                                                    label: '用户ID'
                                                },
                                                {
                                                    type: 'static',
                                                    name: 'email',
                                                    label: '邮箱'
                                                },
                                                {
                                                    type: 'static',
                                                    name: 'status',
                                                    label: '状态'
                                                },
                                                {
                                                    type: 'static',
                                                    name: 'role',
                                                    label: '角色'
                                                }
                                            ]
                                        },
                                        {
                                            md: 6,
                                            body: [
                                                {
                                                    type: 'static',
                                                    name: 'loginCount',
                                                    label: '登录次数'
                                                },
                                                {
                                                    type: 'tpl',
                                                    name: 'lastLoginAt',
                                                    label: '最后登录时间',
                                                    tpl: '${lastLoginAt|date:YYYY-MM-DD HH:mm:ss}'
                                                },
                                                {
                                                    type: 'static',
                                                    name: 'registeredIp',
                                                    label: '注册IP'
                                                },
                                                {
                                                    type: 'static',
                                                    name: 'riskLevel',
                                                    label: '风险等级'
                                                }
                                            ]
                                        }
                                    ]
                                }
                            },
                            {
                                title: '角色管理',
                                body: {
                                    type: 'service',
                                    api: {
                                        method: 'get',
                                        url: '/admin/roles/users/${id}/roles',
                                        headers: {
                                            'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
                                        }
                                    },
                                    body: {
                                        type: 'crud',
                                        api: {
                                            method: 'get',
                                            url: '/admin/roles/users/${id}/roles',
                                            headers: {
                                                'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
                                            }
                                        },
                                        columns: [
                                            {
                                                name: 'id',
                                                label: '角色ID',
                                                type: 'text',
                                                width: 80
                                            },
                                            {
                                                name: 'name',
                                                label: '角色名称',
                                                type: 'text'
                                            },
                                            {
                                                name: 'description',
                                                label: '角色描述',
                                                type: 'text'
                                            },
                                            {
                                                name: 'createdAt',
                                                label: '分配时间',
                                                type: 'tpl',
                                                tpl: '${createdAt|date:YYYY-MM-DD HH:mm:ss}',
                                                width: 150
                                            }
                                        ]
                                    }
                                }
                            },
                            {
                                title: '操作日志',
                                body: {
                                    type: 'service',
                                    api: {
                                        method: 'get',
                                        url: '/admin/users/${id}/logs',
                                        headers: {
                                            'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
                                        }
                                    },
                                    body: {
                                        type: 'crud',
                                        api: {
                                            method: 'get',
                                            url: '/admin/users/${id}/logs',
                                            headers: {
                                                'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
                                            }
                                        },
                                        columns: [
                                            {
                                                name: 'id',
                                                label: '日志ID',
                                                type: 'text',
                                                width: 80
                                            },
                                            {
                                                name: 'action',
                                                label: '操作类型',
                                                type: 'text'
                                            },
                                            {
                                                name: 'description',
                                                label: '操作描述',
                                                type: 'text'
                                            },
                                            {
                                                name: 'ip',
                                                label: 'IP地址',
                                                type: 'text',
                                                width: 120
                                            },
                                            {
                                                name: 'createdAt',
                                                label: '操作时间',
                                                type: 'tpl',
                                                tpl: '${createdAt|date:YYYY-MM-DD HH:mm:ss}',
                                                width: 150
                                            }
                                        ]
                                    }
                                }
                            }
                        ]
                    }
                ]
            }
        }
    };
}

/**
 * 用户编辑对话框配置
 */
function getUserEditDialogConfig() {
    return {
        title: '编辑用户',
        size: 'md',
        body: {
            type: 'form',
            api: {
                method: 'put',
                url: '/admin/users/${id}',
                headers: {
                    'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
                }
            },
            body: [
                {
                    type: 'select',
                    name: 'status',
                    label: '状态',
                    required: true,
                    options: [
                        { label: '正常', value: 'active' },
                        { label: '禁用', value: 'inactive' }
                    ]
                },
                {
                    type: 'select',
                    name: 'role',
                    label: '角色',
                    required: true,
                    options: [
                        { label: '用户', value: 'user' },
                        { label: '管理员', value: 'admin' }
                    ]
                },
                {
                    type: 'select',
                    name: 'riskLevel',
                    label: '风险等级',
                    options: [
                        { label: '低', value: 'low' },
                        { label: '中', value: 'medium' },
                        { label: '高', value: 'high' }
                    ]
                },
                {
                    type: 'textarea',
                    name: 'notes',
                    label: '备注',
                    maxLength: 500
                }
            ]
        }
    };
}

/**
 * 密码修改对话框配置
 */
function getPasswordChangeDialogConfig() {
    return {
        title: '修改密码',
        size: 'sm',
        body: {
            type: 'form',
            api: {
                method: 'put',
                url: '/admin/users/${id}/password',
                headers: {
                    'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
                }
            },
            body: [
                {
                    type: 'input-password',
                    name: 'newPassword',
                    label: '新密码',
                    required: true,
                    minLength: 8,
                    maxLength: 32,
                    validations: {
                        isLength: {
                            min: 8,
                            message: '密码长度至少8位'
                        },
                        matches: {
                            pattern: '^(?=.*[a-zA-Z])(?=.*\\d)',
                            message: '密码必须包含字母和数字'
                        }
                    }
                },
                {
                    type: 'input-password',
                    name: 'confirmPassword',
                    label: '确认密码',
                    required: true,
                    validations: {
                        equalsField: {
                            field: 'newPassword',
                            message: '两次输入的密码不一致'
                        }
                    }
                }
            ]
        }
    };
}

/**
 * 用户新增对话框配置
 */
function getUserCreateDialogConfig() {
    return {
        title: '新增用户',
        size: 'md',
        body: {
            type: 'form',
            api: {
                method: 'post',
                url: '/admin/users',
                headers: {
                    'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
                }
            },
            body: [
                {
                    type: 'input-email',
                    name: 'email',
                    label: '邮箱',
                    required: true,
                    validations: {
                        isEmail: true
                    }
                },
                {
                    type: 'input-password',
                    name: 'password',
                    label: '密码',
                    required: true,
                    minLength: 8,
                    maxLength: 32,
                    validations: {
                        isLength: {
                            min: 8,
                            message: '密码长度至少8位'
                        },
                        matches: {
                            pattern: '^(?=.*[a-zA-Z])(?=.*\\d)',
                            message: '密码必须包含字母和数字'
                        }
                    }
                },
                {
                    type: 'select',
                    name: 'status',
                    label: '状态',
                    required: true,
                    value: 'active',
                    options: [
                        { label: '正常', value: 'active' },
                        { label: '禁用', value: 'inactive' }
                    ]
                },
                {
                    type: 'select',
                    name: 'role',
                    label: '角色',
                    required: true,
                    value: 'user',
                    options: [
                        { label: '用户', value: 'user' },
                        { label: '管理员', value: 'admin' }
                    ]
                }
            ]
        }
    };
}
