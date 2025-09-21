/**
 * 标签管理模块组件
 * 包含主题和关键词的管理功能
 */

function resolveTagsBackendUrl(path) {
  if (typeof window !== 'undefined' && typeof window.buildAdminBackendUrl === 'function') {
    return window.buildAdminBackendUrl(path);
  }
  return path;
}

function buildAuthHeaders() {
  const token = (typeof localStorage !== 'undefined') ? localStorage.getItem('admin_token') : '';
  return token ? { 'Authorization': 'Bearer ' + token } : {};
}

/**
 * 获取标签统计信息
 */
function getTagsStatsSection() {
  return {
    type: 'service',
    api: {
      method: 'get',
      url: resolveTagsBackendUrl('/admin/tags/aggregation/statistics'),
      headers: buildAuthHeaders(),
      adaptor: function (payload) {
        const data = payload?.data || payload || {};
        return {
          status: payload?.success === false ? 1 : 0,
          msg: payload?.error || '',
          data
        };
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
              title: '总主题数',
              body: {
                type: 'tpl',
                tpl: '<div class="display-6">${totalTopics || 0}</div>'
              }
            }
          },
          {
            md: 3,
            body: {
              type: 'panel',
              title: '总关键词数',
              body: {
                type: 'tpl',
                tpl: '<div class="display-6">${totalKeywords || 0}</div>'
              }
            }
          },
          {
            md: 3,
            body: {
              type: 'panel',
              title: '今日新增标签',
              body: {
                type: 'tpl',
                tpl: '<div class="display-6">${todayNewTags || 0}</div>'
              }
            }
          },
          {
            md: 3,
            body: {
              type: 'panel',
              title: '活跃标签数',
              body: {
                type: 'tpl',
                tpl: '<div class="display-6">${activeTags || 0}</div>'
              }
            }
          }
        ]
      }
    ]
  };
}

/**
 * 获取主题管理表格
 */
function getTopicsTable() {
  return {
    type: 'crud',
    api: {
      method: 'get',
      url: resolveTagsBackendUrl('/admin/tags/aggregation/topics'),
      headers: buildAuthHeaders(),
      data: {
        search: typeof localStorage !== 'undefined' ? localStorage.getItem('tag_search') || '' : ''
      },
      adaptor: function(payload) {
        const topics = payload?.data?.topics || payload?.topics || [];
        return {
          status: payload?.success === false ? 1 : 0,
          msg: payload?.error || '',
          data: {
            items: topics,
            total: topics.length
          }
        };
      }
    },
    filter: {
      title: '搜索主题',
      submitText: '搜索',
      controls: [
        {
          type: 'text',
          name: 'search',
          label: '主题名称',
          placeholder: '输入主题名称进行搜索',
          value: typeof localStorage !== 'undefined' ? localStorage.getItem('tag_search') || '' : '',
          clearable: true,
          onChange: function(value) {
            if (typeof localStorage !== 'undefined' && !value) {
              localStorage.removeItem('tag_search');
            }
          }
        }
      ]
    },
    columns: [
      {
        name: 'id',
        label: 'ID',
        type: 'text',
        width: 80
      },
      {
        name: 'topicName',
        label: '主题名称',
        type: 'text',
        searchable: true
      },
      {
        name: 'entryCount',
        label: '关联文章数',
        type: 'text',
        sortable: true
      },
      {
        name: 'lastUsedAt',
        label: '最后使用',
        type: 'datetime',
        format: 'YYYY-MM-DD HH:mm'
      },
      {
        name: 'createdAt',
        label: '创建时间',
        type: 'datetime',
        format: 'YYYY-MM-DD HH:mm'
      },
      {
        type: 'operation',
        label: '操作',
        buttons: [
          {
            label: '查看详情',
            type: 'button',
            level: 'primary',
            actionType: 'dialog',
            dialog: {
              title: '主题详情',
              body: {
                type: 'form',
                initApi: {
                  method: 'get',
                  url: resolveTagsBackendUrl('/admin/tags/aggregation/topics/${topicName}/detail'),
                  headers: buildAuthHeaders()
                },
                body: [
                  {
                    type: 'static',
                    name: 'topicName',
                    label: '主题名称'
                  },
                  {
                    type: 'static',
                    name: 'entryCount',
                    label: '关联文章数'
                  },
                  {
                    type: 'static',
                    name: 'createdAt',
                    label: '创建时间'
                  },
                  {
                    type: 'static',
                    name: 'lastUsedAt',
                    label: '最后使用时间'
                  }
                ]
              }
            }
          }
        ]
      }
    ],
    filter: {
      title: '搜索主题',
      submitText: '搜索',
      controls: [
        {
          type: 'text',
          name: 'keyword',
          label: '关键词',
          placeholder: '请输入主题名称搜索'
        }
      ]
    },
    features: ['filter', 'create']
  };
}

/**
 * 获取关键词管理表格
 */
function getKeywordsTable() {
  return {
    type: 'crud',
    api: {
      method: 'get',
      url: resolveTagsBackendUrl('/admin/tags/aggregation/keywords'),
      headers: buildAuthHeaders(),
      data: {
        search: typeof localStorage !== 'undefined' ? localStorage.getItem('tag_search') || '' : ''
      },
      adaptor: function(payload) {
        const keywords = payload?.data?.keywords || payload?.keywords || [];
        return {
          status: payload?.success === false ? 1 : 0,
          msg: payload?.error || '',
          data: {
            items: keywords,
            total: keywords.length
          }
        };
      }
    },
    filter: {
      title: '搜索关键词',
      submitText: '搜索',
      controls: [
        {
          type: 'text',
          name: 'search',
          label: '关键词',
          placeholder: '输入关键词进行搜索',
          value: typeof localStorage !== 'undefined' ? localStorage.getItem('tag_search') || '' : '',
          clearable: true,
          onChange: function(value) {
            if (typeof localStorage !== 'undefined' && !value) {
              localStorage.removeItem('tag_search');
            }
          }
        }
      ]
    },
    columns: [
      {
        name: 'id',
        label: 'ID',
        type: 'text',
        width: 80
      },
      {
        name: 'keywordName',
        label: '关键词',
        type: 'text',
        searchable: true
      },
      {
        name: 'entryCount',
        label: '关联文章数',
        type: 'text',
        sortable: true
      },
      {
        name: 'lastUsedAt',
        label: '最后使用',
        type: 'datetime',
        format: 'YYYY-MM-DD HH:mm'
      },
      {
        name: 'createdAt',
        label: '创建时间',
        type: 'datetime',
        format: 'YYYY-MM-DD HH:mm'
      },
      {
        type: 'operation',
        label: '操作',
        buttons: [
          {
            label: '查看详情',
            type: 'button',
            level: 'primary',
            actionType: 'dialog',
            dialog: {
              title: '关键词详情',
              body: {
                type: 'form',
                initApi: {
                  method: 'get',
                  url: resolveTagsBackendUrl('/admin/tags/aggregation/keywords/${keywordName}/detail'),
                  headers: buildAuthHeaders()
                },
                body: [
                  {
                    type: 'static',
                    name: 'keywordName',
                    label: '关键词'
                  },
                  {
                    type: 'static',
                    name: 'entryCount',
                    label: '关联文章数'
                  },
                  {
                    type: 'static',
                    name: 'createdAt',
                    label: '创建时间'
                  },
                  {
                    type: 'static',
                    name: 'lastUsedAt',
                    label: '最后使用时间'
                  }
                ]
              }
            }
          }
        ]
      }
    ],
    filter: {
      title: '搜索关键词',
      submitText: '搜索',
      controls: [
        {
          type: 'text',
          name: 'keyword',
          label: '关键词',
          placeholder: '请输入关键词搜索'
        }
      ]
    },
    features: ['filter']
  };
}

/**
 * 标签管理页面配置
 */
function getTagsPageConfig() {
  return {
    type: 'page',
    title: '标签管理',
    onEvent: {
      type: 'page',
      init: function() {
        // 页面初始化时不立即清理搜索参数，让用户可以看到搜索结果
        // 可以在用户进行新的搜索时再清理
      }
    },
    body: [
      getTagsStatsSection(),
      {
        type: 'divider'
      },
      {
        type: 'tabs',
        activeKey: typeof localStorage !== 'undefined' ? (localStorage.getItem('tags_tab') === 'keywords' ? 1 : 0) : 0,
        tabs: [
          {
            title: '主题管理',
            body: getTopicsTable()
          },
          {
            title: '关键词管理',
            body: getKeywordsTable()
          },
          {
            title: '标签操作',
            body: {
              type: 'form',
              title: '标签管理操作',
              mode: 'horizontal',
              horizontal: {
                left: 3,
                right: 9
              },
              api: {
                method: 'post',
                url: resolveTagsBackendUrl('/admin/tags/aggregation/operations'),
                headers: buildAuthHeaders()
              },
              body: [
                {
                  type: 'select',
                  name: 'operation',
                  label: '操作类型',
                  required: true,
                  options: [
                    { label: '重新聚合标签', value: 'reaggregate' },
                    { label: '清理无效标签', value: 'cleanup' },
                    { label: '统计标签使用', value: 'statistics' }
                  ]
                },
                {
                  type: 'text',
                  name: 'userId',
                  label: '用户ID（可选）',
                  placeholder: '留空则操作所有用户'
                },
                {
                  type: 'textarea',
                  name: 'reason',
                  label: '操作原因',
                  placeholder: '请输入操作原因（可选）'
                }
              ],
              actions: [
                {
                  type: 'submit',
                  label: '执行操作',
                  level: 'primary'
                }
              ]
            }
          }
        ]
      }
    ]
  };
}

// 导出函数
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getTagsPageConfig
  };
} else if (typeof window !== 'undefined') {
  window.TagsComponents = {
    getTagsPageConfig
  };
}