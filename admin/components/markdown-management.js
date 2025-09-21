/**
 * Markdown管理模块组件
 */

function resolveMarkdownBackendUrl(path) {
  if (typeof window !== 'undefined' && typeof window.buildAdminBackendUrl === 'function') {
    return window.buildAdminBackendUrl(path);
  }
  return path;
}

function buildAuthHeaders() {
  const token = (typeof localStorage !== 'undefined') ? localStorage.getItem('admin_token') : '';
  return token ? { 'Authorization': 'Bearer ' + token } : {};
}

function getMarkdownStatsSection() {
  return {
    type: 'service',
    api: {
      method: 'get',
      url: resolveMarkdownBackendUrl('/admin/markdown/stats'),
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
              title: '总条目',
              body: {
                type: 'tpl',
                tpl: '<div class="display-6">${overview.totalEntries || 0}</div>'
              }
            }
          },
          {
            md: 3,
            body: {
              type: 'panel',
              title: '已有Markdown',
              body: {
                type: 'tpl',
                tpl: '<div class="display-6 text-success">${overview.withMarkdown || 0}</div>'
              }
            }
          },
          {
            md: 3,
            body: {
              type: 'panel',
              title: '待生成',
              body: {
                type: 'tpl',
                tpl: '<div class="display-6 text-warning">${overview.withoutMarkdown || 0}</div>'
              }
            }
          },
          {
            md: 3,
            body: {
              type: 'panel',
              title: '平均字数',
              body: {
                type: 'tpl',
                tpl: '<div class="display-6">${(overview.avgWordCount || 0) | round:0}</div>'
              }
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
              type: 'panel',
              title: '按来源统计',
              body: [
                {
                  type: 'table',
                  source: '${sourceStats}',
                  columns: [
                    { name: 'sourceName', label: '来源', placeholder: '未知来源' },
                    { name: 'totalEntries', label: '总条目' },
                    { name: 'withMarkdown', label: '已有Markdown' },
                    { name: 'avgWordCount', label: '平均字数', tpl: '${avgWordCount | round:0}' }
                  ],
                  placeholder: '暂无数据'
                }
              ]
            }
          },
          {
            md: 6,
            body: {
              type: 'panel',
              title: '最近30天生成趋势',
              body: [
                {
                  type: 'table',
                  source: '${dateStats}',
                  columns: [
                    { name: 'date', label: '日期' },
                    { name: 'count', label: '生成数量' },
                    { name: 'wordCount', label: '累积字数' }
                  ],
                  placeholder: '暂无统计数据'
                }
              ]
            }
          }
        ]
      }
    ]
  };
}

function getMarkdownCrudSection() {
  return {
    type: 'crud',
    syncLocation: false,
    primaryField: 'id',
    api: {
      method: 'get',
      url: resolveMarkdownBackendUrl('/admin/markdown/list'),
      headers: buildAuthHeaders(),
      adaptor: function (payload) {
        if (payload?.success === false) {
          return { status: 1, msg: payload?.error || '加载失败' };
        }
        const pagination = payload?.pagination || {};
        return {
          status: 0,
          data: {
            items: payload?.contents || [],
            total: pagination.total || 0,
            page: pagination.page || 1,
            perPage: pagination.pageSize || 20
          }
        };
      }
    },
    defaultParams: {
      page: 1,
      pageSize: 20,
      hasMarkdown: 'true'
    },
    pageField: 'page',
    perPageField: 'pageSize',
    headerToolbar: [
      'filter-toggler',
      'bulkActions',
      {
        type: 'button',
        label: '导出CSV',
        level: 'info',
        actionType: 'download',
        api: {
          method: 'get',
          url: resolveMarkdownBackendUrl('/admin/markdown/export'),
          headers: buildAuthHeaders()
        }
      },
      'reload'
    ],
    footerToolbar: [
      'statistics',
      'pagination'
    ],
    filter: {
      title: '筛选条件',
      submitText: '查询',
      body: [
        {
          type: 'input-text',
          name: 'searchQuery',
          label: '关键词',
          placeholder: '标题或Markdown内容关键字'
        },
        {
          type: 'select',
          name: 'hasMarkdown',
          label: '状态',
          value: 'true',
          options: [
            { label: '全部', value: '' },
            { label: '已有Markdown', value: 'true' },
            { label: '待生成', value: 'false' }
          ]
        },
        {
          type: 'input-number',
          name: 'minWordCount',
          label: '最小字数'
        },
        {
          type: 'input-number',
          name: 'maxWordCount',
          label: '最大字数'
        }
      ]
    },
    bulkActions: [
      {
        label: '批量重新生成',
        level: 'primary',
        confirmText: '确定要重新生成选中的Markdown吗？',
        actionType: 'ajax',
        api: {
          method: 'post',
          url: resolveMarkdownBackendUrl('/admin/markdown/batch-regenerate'),
          headers: buildAuthHeaders(),
          data: {
            selectedItems: '${selectedItems}'
          },
          requestAdaptor: function(api) {
            const items = api.data && api.data.selectedItems;
            if (Array.isArray(items)) {
              api.data.entryIds = items.map(function(item) { return item.id; });
              delete api.data.selectedItems;
            }
            return api;
          }
        },
        reload: true
      }
    ],
    columns: [
      {
        name: 'title',
        label: '标题',
        width: 320,
        tpl: '${title}'
      },
      {
        name: 'sourceName',
        label: '来源'
      },
      {
        name: 'hasMarkdown',
        label: '状态',
        type: 'mapping',
        map: {
          true: '<span class="badge badge-success">已生成</span>',
          false: '<span class="badge badge-warning">待生成</span>'
        }
      },
      {
        name: 'wordCount',
        label: '字数'
      },
      {
        name: 'publishedAt',
        label: '发布时间',
        type: 'datetime',
        format: 'YYYY-MM-DD HH:mm'
      },
      {
        type: 'operation',
        label: '操作',
        width: 160,
        buttons: [
          {
            type: 'button',
            level: 'link',
            icon: 'fa fa-eye',
            tooltip: '查看详情',
            actionType: 'dialog',
            dialog: {
              title: 'Markdown详情',
              size: 'lg',
              body: {
                type: 'service',
                api: {
                  method: 'get',
                  url: resolveMarkdownBackendUrl('/admin/markdown/${id}'),
                  headers: buildAuthHeaders()
                },
                body: [
                  {
                    type: 'grid',
                    columns: [
                      {
                        md: 6,
                        body: {
                          type: 'form',
                          mode: 'horizontal',
                          static: true,
                          body: [
                            { type: 'static', name: 'content.title', label: '标题' },
                            { type: 'static', name: 'content.sourceName', label: '来源' },
                            { type: 'static', name: 'content.link', label: '原文链接', tpl: '<a href="${content.link}" target="_blank">${content.link}</a>' },
                            { type: 'static', name: 'content.wordCount', label: '字数' },
                            { type: 'static', name: 'content.modelUsed', label: '模型' }
                          ]
                        }
                      },
                      {
                        md: 6,
                        body: {
                          type: 'form',
                          mode: 'horizontal',
                          static: true,
                          body: [
                            { type: 'static', name: 'content.sentiment', label: '情感倾向' },
                            { type: 'static', name: 'content.processingTime', label: '处理耗时(ms)' },
                            { type: 'static', name: 'content.publishedAt', label: '发布时间', tpl: '${content.publishedAt | date:YYYY-MM-DD HH:mm}' },
                            { type: 'static', name: 'content.updatedAt', label: '更新时间', tpl: '${content.updatedAt | date:YYYY-MM-DD HH:mm}' }
                          ]
                        }
                      }
                    ]
                  },
                  {
                    type: 'tabs',
                    tabs: [
                      {
                        title: 'Markdown预览',
                        body: {
                          type: 'tpl',
                          tpl: '<pre style="white-space: pre-wrap; font-family: monospace; background: #f5f5f5; padding: 15px; border-radius: 4px; max-height: 500px; overflow-y: auto;">${content.markdownContent || "暂无Markdown内容"}</pre>'
                        }
                      },
                      {
                        title: '主题 & 关键词',
                        body: {
                          type: 'grid',
                          columns: [
                            {
                              md: 6,
                              body: {
                                type: 'each',
                                name: 'content.topics',
                                placeholder: '暂无主题',
                                items: {
                                  type: 'tpl',
                                  tpl: '<span class="badge badge-info m-r-xs">${item}</span>'
                                }
                              }
                            },
                            {
                              md: 6,
                              body: {
                                type: 'each',
                                name: 'content.keywords',
                                placeholder: '暂无关键词',
                                items: {
                                  type: 'tpl',
                                  tpl: '<span class="badge badge-pill badge-secondary m-r-xs">${item}</span>'
                                }
                              }
                            }
                          ]
                        }
                      }
                    ]
                  }
                ]
              }
            }
          },
          {
            type: 'button',
            level: 'link',
            icon: 'fa fa-refresh',
            tooltip: '重新生成',
            actionType: 'ajax',
            api: {
              method: 'post',
              url: resolveMarkdownBackendUrl('/admin/markdown/${id}/regenerate'),
              headers: buildAuthHeaders()
            },
            reload: true
          },
          {
            type: 'button',
            level: 'link',
            icon: 'fa fa-trash',
            tooltip: '删除Markdown',
            confirmText: '仅删除Markdown内容，原始条目将保留。确定继续？',
            actionType: 'ajax',
            api: {
              method: 'delete',
              url: resolveMarkdownBackendUrl('/admin/markdown/${id}'),
              headers: buildAuthHeaders()
            },
            reload: true
          }
        ]
      }
    ]
  };
}

function getMarkdownPageConfig() {
  return {
    type: 'page',
    title: 'Markdown管理',
    body: [
      getMarkdownStatsSection(),
      {
        type: 'divider'
      },
      getMarkdownCrudSection()
    ]
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getMarkdownPageConfig
  };
} else if (typeof window !== 'undefined') {
  window.MarkdownComponents = {
    getMarkdownPageConfig
  };
}
