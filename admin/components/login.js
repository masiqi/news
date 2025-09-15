/**
 * 登录页面组件
 */

/**
 * 登录页面配置
 */
function getLoginPageConfig() {
    return {
        type: 'page',
        title: 'AI资讯平台管理后台 - 登录',
        body: {
            type: 'form',
            title: '管理员登录',
            mode: 'horizontal',
            horizontal: {
                left: 3,
                right: 9
            },
            api: {
                method: 'post',
                url: 'http://localhost:8787/auth/admin-login',
                adaptor: function(payload) {
                    console.log('登录响应:', payload);
                    if (payload.message === '管理员登录成功') {
                        // 登录成功，保存token
                        localStorage.setItem('admin_logged_in', 'true');
                        localStorage.setItem('admin_token', payload.token);
                        localStorage.setItem('token_expiry', Date.now() + 24 * 60 * 60 * 1000); // 24小时后过期
                        
                        // 设置token过期检查
                        if (typeof startTokenExpiryCheck === 'function') {
                            startTokenExpiryCheck();
                        }
                        
                        // 跳转到管理后台
                        setTimeout(() => {
                            window.location.hash = '#/';
                            if (typeof renderAdminPage === 'function') {
                                renderAdminPage();
                            }
                        }, 500);
                        
                        return {
                            status: 0,
                            msg: '登录成功'
                        };
                    } else {
                        return {
                            status: 1,
                            msg: payload.error || '登录失败'
                        };
                    }
                }
            },
            body: [
                {
                    type: 'input-text',
                    name: 'username',
                    label: '用户名',
                    required: true,
                    value: 'admin',
                    description: '请输入管理员用户名'
                },
                {
                    type: 'input-password',
                    name: 'password',
                    label: '密码',
                    required: true,
                    value: 'admin123',
                    description: '请输入管理员密码'
                }
            ],
            actions: [
                {
                    type: 'submit',
                    label: '登录',
                    level: 'primary',
                    block: true
                }
            ]
        }
    };
}

// 导出函数
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getLoginPageConfig
    };
} else if (typeof window !== 'undefined') {
    window.LoginComponents = {
        getLoginPageConfig
    };
}