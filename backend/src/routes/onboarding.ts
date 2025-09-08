import { Hono } from 'hono';
import { adminAuthMiddleware, getCurrentUser } from '../../middleware/admin-auth.middleware';
import { userAuthMiddleware } from '../../middleware/auth.middleware';
import { OnboardingService, InterestInput, OnboardingStep, InterestCategory, UserInterest, RecommendedSource } from '../../services/onboarding/onboarding.service';
import { InterestService, InterestWithStats } from '../../services/onboarding/interest.service';
import { RecommendationService } from '../../services/onboarding/recommendation.service';
import { db } from '../index';
import { sql, eq, and, or, isNull } from 'drizzle-orm';
import type { Env } from '../../env';

const onboardingRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// 应用认证中间件
onboardingRoutes.use('*', userAuthMiddleware);

// 获取兴趣分类列表
onboardingRoutes.get('/categories', async (c) => {
  try {
    const interestService = new InterestService();
    const categories = await interestService.getAllCategories();
    
    return c.json({ 
      success: true, 
      categories 
    });
  } catch (error) {
    console.error('获取兴趣分类失败:', error);
    return c.json({ 
      success: false, 
      error: '获取兴趣分类失败' 
    }, 500);
  }
});

// 获取热门兴趣分类
onboardingRoutes.get('/categories/popular', async (c) => {
  try {
    const interestService = new InterestService();
    const { limit } = c.req.query();
    const categories = await interestService.getPopularCategories(parseInt(limit as string) || 10);
    
    return c.json({ 
      success: true, 
      categories 
    });
  } catch (error) {
    console.error('获取热门分类失败:', error);
    return c.json({ 
      success: false, 
      error: '获取热门分类失败' 
    }, 500);
  }
});

// 搜索兴趣分类
onboardingRoutes.get('/categories/search', async (c) => {
  try {
    const { q } = c.req.query();
    const interestService = new InterestService();
    const categories = await interestService.searchCategories(q as string);
    
    return c.json({ 
      success: true, 
      categories,
      total: categories.length
    });
  } catch (error) {
    console.error('搜索兴趣分类失败:', error);
    return c.json({ 
      success: false, 
      error: '搜索兴趣分类失败' 
    }, 500);
  }
});

// 获取用户兴趣
onboardingRoutes.get('/interests', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const interestService = new InterestService();
    const interests = await interestService.getUserInterests(user.id);
    
    return c.json({ 
      success: true, 
      interests 
    });
  } catch (error) {
    console.error('获取用户兴趣失败:', error);
    return c.json({ 
      success: false, 
      error: '获取用户兴趣失败' 
    }, 500);
  }
});

// 保存用户兴趣
onboardingRoutes.post('/interests', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const { interests } = await c.req.json();
    
    if (!Array.isArray(interests)) {
      return c.json({ success: false, error: '兴趣数据格式错误' }, 400);
    }

    // 验证兴趣数据格式
    for (const interest of interests) {
      if (!interest.categoryId || !interest.level) {
        return c.json({ success: false, error: '兴趣数据格式不正确' }, 400);
      }
      
      if (!['low', 'medium', 'high'].includes(interest.level)) {
        return c.json({ success: false, error: '兴趣级别不正确' }, 400);
      }
    }

    const onboardingService = new OnboardingService();
    await onboardingService.saveUserInterests(user.id, interests);
    
    return c.json({ 
      success: true, 
      message: '兴趣保存成功'
    });
  } catch (error) {
    console.error('保存用户兴趣失败:', error);
    return c.json({ 
      success: false, 
      error: '保存用户兴趣失败' 
    }, 500);
  }
});

// 获取推荐RSS源
onboardingRoutes.post('/recommendations', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const { interests } = await c.req.json();
    
    if (!Array.isArray(interests) || interests.length === 0) {
      return c.json({ success: false, error: '兴趣数据格式错误' }, 400);
    }

    const onboardingService = new OnboardingService();
    const recommendations = await onboardingService.recommendSources(user.id, interests);
    
    return c.json({ 
      success: true, 
      recommendations 
    });
  } catch (error) {
    console.error('获取推荐RSS源失败:', error);
    return c.json({ 
      success: false, 
      error: '获取推荐RSS源失败' 
    }, 500);
  }
});

// 确认选择的RSS源
onboardingRoutes.post('/confirm-sources', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const { sourceIds } = await c.req.json();
    
    if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
      return c.json({ success: false, error: '源ID数据格式错误' }, 400);
    }

    const onboardingService = new OnboardingService();
    const result = await onboardingService.confirmSources(user.id, sourceIds);
    
    return c.json(result);
  } catch (error) {
    console.error('确认RSS源失败:', error);
    return c.json({ 
      success: false, 
      error: '确认RSS源失败' 
    }, 500);
  }
});

// 获取引导状态
onboardingRoutes.get('/status', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const onboardingService = new OnboardingService();
    const status = await onboardingService.getOnboardingStatus(user.id);
    
    if (!status) {
      // 如果没有状态记录，检查是否需要引导
      const needsOnboarding = await onboardingService.needsOnboarding(user.id);
      
      return c.json({ 
        success: true, 
        status: null,
        needsOnboarding
      });
    }
    
    const progress = await onboardingService.getOnboardingProgress(user.id);
    
    return c.json({ 
      success: true, 
      status,
      progress,
      needsOnboarding: false
    });
  } catch (error) {
    console.error('获取引导状态失败:', error);
    return c.json({ 
      success: false, 
      error: '获取引导状态失败' 
    }, 500);
  }
});

// 更新引导状态
onboardingRoutes.put('/status', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const { step, data } = await c.req.json();
    
    if (!step) {
      return c.json({ success: false, error: '步骤参数缺失' }, 400);
    }

    const onboardingService = new OnboardingService();
    const status = await onboardingService.updateOnboardingStatus(user.id, { step, data });
    
    return c.json({ 
      success: true, 
      status 
    });
  } catch (error) {
    console.error('更新引导状态失败:', error);
    return c.json({ 
      success: false, 
      error: '更新引导状态失败' 
    }, 500);
  }
});

// 跳过引导流程
onboardingRoutes.post('/skip', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const onboardingService = new OnboardingService();
    const result = await onboardingService.skipOnboarding(user.id);
    
    return c.json(result);
  } catch (error) {
    console.error('跳过引导流程失败:', error);
    return c.json({ 
      success: false, 
      error: '跳过引导流程失败' 
    }, 500);
  }
});

// 完成引导流程
onboardingRoutes.post('/complete', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const onboardingService = new OnboardingService();
    const result = await onboardingService.completeOnboarding(user.id);
    
    return c.json(result);
  } catch (error) {
    console.error('完成引导流程失败:', error);
    return c.json({ 
      success: false, 
      error: '完成引导流程失败' 
    }, 500);
  }
});

// 初始化引导流程
onboardingRoutes.post('/initialize', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const onboardingService = new OnboardingService();
    const status = await onboardingService.initializeOnboarding(user.id);
    
    return c.json({ 
      success: true, 
      status 
    });
  } catch (error) {
    console.error('初始化引导流程失败:', error);
    return c.json({ 
      success: false, 
      error: '初始化引导流程失败' 
    }, 500);
  }
});

// 获取引导进度
onboardingRoutes.get('/progress', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const onboardingService = new OnboardingService();
    const progress = await onboardingService.getOnboardingProgress(user.id);
    
    return c.json({ 
      success: true, 
      progress 
    });
  } catch (error) {
    console.error('获取引导进度失败:', error);
    return c.json({ 
      success: false, 
      error: '获取引导进度失败' 
    }, 500);
  }
});

// 获取个性化推荐
onboardingRoutes.get('/personalized-recommendations', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const { limit } = c.req.query();
    const recommendationService = new RecommendationService();
    const recommendations = await recommendationService.getPersonalizedRecommendations(user.id, parseInt(limit as string) || 20);
    
    return c.json({ 
      success: true, 
      recommendations 
    });
  } catch (error) {
    console.error('获取个性化推荐失败:', error);
    return c.json({ 
      success: false, 
      error: '获取个性化推荐失败' 
    }, 500);
  }
});

// 获取热门推荐源
onboardingRoutes.get('/trending-recommendations', async (c) => {
  try {
    const { limit } = c.req.query();
    const recommendationService = new RecommendationService();
    const recommendations = await recommendationService.getTrendingRecommendedSources(parseInt(limit as string) || 10);
    
    return c.json({ 
      success: true, 
      recommendations 
    });
  } catch (error) {
    console.error('获取热门推荐失败:', error);
    return c.json({ 
      success: false, 
      error: '获取热门推荐失败' 
    }, 500);
  }
});

// 基于分类获取推荐
onboardingRoutes.get('/recommendations/by-category/:categoryId', async (c) => {
  try {
    const categoryId = parseInt(c.req.param('categoryId'));
    const { limit } = c.req.query();
    
    if (isNaN(categoryId)) {
      return c.json({ success: false, error: '分类ID无效' }, 400);
    }

    const recommendationService = new RecommendationService();
    const recommendations = await recommendationService.getRecommendationsByCategory(categoryId, parseInt(limit as string) || 20);
    
    return c.json({ 
      success: true, 
      recommendations 
    });
  } catch (error) {
    console.error('基于分类获取推荐失败:', error);
    return c.json({ 
      success: false, 
      error: '基于分类获取推荐失败' 
    }, 500);
  }
});

export default onboardingRoutes;