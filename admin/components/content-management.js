/**
 * 内容管理模块组件（AMIS）
 * 使用后端 /api/content 列表和 /api/content/:id 详情接口
 */

function resolveContentBackendUrl(path) {
  if (typeof window !== 'undefined' && typeof window.buildAdminBackendUrl === 'function') {
    return window.buildAdminBackendUrl(path);
  }
  return path;
}

function getContentPageConfig() {
  const listCrud = {
    type: 'crud',
    api: {
      method: 'get',
      url: resolveContentBackendUrl('/api/content'),
      headers: {
        'Authorization': 'Bearer ' + (localStorage.getItem('admin_token') || '')
      },
      adaptor: function (payload, response) {
        const data = response.data || response;
        const contents = data.contents || [];
        const p = data.pagination || {};
        return {
          status: 0,
          msg: '',
          data: {
            items: contents,
            total: p.total || 0,
            page: p.page || 1,
            perPage: p.pageSize || 20
          }
        };
      }
    },
    defaultParams: {
      page: 1,
      pageSize: 20
    },
    pageField: 'page',
    perPageField: 'pageSize',
    syncLocation: false,
    footerToolbar: ['statistics', 'pagination'],
    filter: {
      title: '筛选',
      submitText: '搜索',
      controls: [
        { type: 'text', name: 'searchQuery', label: '关键词', placeholder: '标题/正文 关键字' },
        {
          type: 'select', name: 'hasWebContent', label: '有内容', clearable: true,
          options: [
            { label: '全部', value: '' },
            { label: '是', value: 'true' },
            { label: '否', value: 'false' }
          ]
        },
        {
          type: 'select', name: 'hasTopics', label: '有主题', clearable: true,
          options: [
            { label: '全部', value: '' },
            { label: '是', value: 'true' },
            { label: '否', value: 'false' }
          ]
        }
        // 可按需补充源筛选：
        // { type: 'select', name: 'sourceId', label: 'RSS源', source: { method:'get', url: '/sources/public', adaptor: ... } }
      ]
    },
    columns: [
      { name: 'id', label: 'ID', width: 60 },
      { name: 'sourceName', label: 'RSS源', width: 120 },
      { name: 'title', label: '标题', width: 300 },
      {
        name: 'webContent', label: '内容', width: 400,
        tpl: '${webContent|substring:0:120}${webContent && webContent.length > 120 ? "..." : "-"}'
      },
      {
        name: 'publishedAt',
        label: '发布时间',
        type: 'datetime',
        format: 'YYYY-MM-DD HH:mm',
        valueFormat: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
        width: 160
      },
      {
        type: 'operation', label: '操作', width: 180,
        buttons: [
          {
            type: 'button', 
            label: '', 
            icon: 'fa fa-eye', 
            tooltip: '查看详情', 
            level: 'link', 
            actionType: 'dialog',
            dialog: getContentDetailDialogConfig()
          },
          {
            type: 'button', 
            label: '', 
            icon: 'fa fa-refresh', 
            tooltip: '重新抓取', 
            level: 'link',
            actionType: 'ajax',
            api: {
              method: 'post',
              url: resolveContentBackendUrl('/api/content/${id}/reprocess'),
              headers: {
                'Authorization': 'Bearer ' + (localStorage.getItem('admin_token') || '')
              }
            }
          },
          {
            type: 'button', 
            label: '', 
            icon: 'fa fa-download', 
            tooltip: '下载Markdown', 
            level: 'link',
            actionType: 'url',
            url: resolveContentBackendUrl('/api/content/${id}/download')
          }
        ]
      }
    ]
  };

  const body = [listCrud];

  if (typeof NavComponents !== 'undefined' && NavComponents.createNavLayout) {
    return NavComponents.createNavLayout({ title: '内容管理', body });
  }
  return { type: 'page', title: '内容管理', body };
}

function getContentDetailDialogConfig() {
  return {
    title: '内容详情', size: 'xl',
    body: {
      type: 'service',
      api: {
        method: 'get',
        url: resolveContentBackendUrl('/api/content/${id}'),
        headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('admin_token') || '') },
        adaptor: function (payload, response) {
          const data = response.data || response;
          const c = data.content || data;
          // 确保所有数据都正确传递
          return { status: 0, msg: '', data: c };
        }
      },
      body: {
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
                    { type: 'static', name: 'id', label: 'ID' },
                    { type: 'static', name: 'title', label: '标题' },
                    { type: 'static', name: 'sourceName', label: 'RSS源' },
                    { type: 'static', name: 'link', label: '原文链接', tpl: '<a href="${link}" target="_blank">${link}</a>' }
                  ]
                },
                {
                  md: 6,
                  body: [
                    {
                      type: 'datetime',
                      name: 'publishedAt',
                      label: '发布时间',
                      format: 'YYYY-MM-DD HH:mm:ss',
                      valueFormat: 'YYYY-MM-DDTHH:mm:ss.SSSZ'
                    },
                    { type: 'tpl', name: 'processedAt', label: '处理时间', tpl: '${processedAt|date:YYYY-MM-DD HH:mm:ss}' },
                    { type: 'static', name: 'wordCount', label: '字数' },
                    { type: 'static', name: 'modelUsed', label: '使用模型' },
                    { type: 'static', name: 'sentiment', label: '情感倾向' },
                    { type: 'static', name: 'processingTime', label: '处理耗时(ms)' }
                  ]
                }
              ]
            }
          },
          {
            title: 'Markdown预览',
            body: {
              type: 'markdown',
              value: '${webContent || "暂无内容"}'
            }
          },
          {
            title: '主题与关键词',
            body: {
              type: 'grid',
              columns: [
                { 
                  md: 6, 
                  body: { 
                    type: 'static',
                    name: 'topics',
                    label: '主题'
                  } 
                },
                { 
                  md: 6, 
                  body: { 
                    type: 'static',
                    name: 'keywords', 
                    label: '关键词'
                  } 
                }
              ]
            }
          },
          {
            title: 'AI分析结果',
            body: {
              type: 'panel',
              title: 'AI分析摘要',
              body: {
                type: 'static',
                name: 'analysis',
                label: '分析结果',
                value: '${analysis || "暂无分析结果"}'
              }
            }
          },
          {
            title: '教育价值',
            body: {
              type: 'panel',
              title: '教育价值评估',
              body: {
                type: 'static',
                name: 'educationalValue',
                label: '教育价值',
                value: '${educationalValue || "暂无教育价值评估"}'
              }
            }
          }
        ]
      }
    }
  };
}

// UMD-style export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getContentPageConfig };
} else if (typeof window !== 'undefined') {
  window.getContentPageConfig = getContentPageConfig;
  window.ContentComponents = { getContentPageConfig };
}
