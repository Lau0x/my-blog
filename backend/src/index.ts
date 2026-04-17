// import type { Core } from '@strapi/strapi';

const PUBLIC_ACTIONS = [
  'api::ad-config.ad-config.find',
  'api::article.article.find',
  'api::article.article.findOne',
];

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  async bootstrap({ strapi }) {
    try {
      const publicRole = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { type: 'public' },
        populate: { permissions: true },
      });
      if (!publicRole) return;

      const existing = new Set((publicRole.permissions || []).map((p: any) => p.action));

      for (const action of PUBLIC_ACTIONS) {
        if (!existing.has(action)) {
          await strapi.db.query('plugin::users-permissions.permission').create({
            data: { action, role: publicRole.id },
          });
          strapi.log.info(`[bootstrap] Public role permission granted: ${action}`);
        }
      }

      // 初始化 Single Type ad-config（避免首次访问返回 404）
      const adConfig = await strapi.documents('api::ad-config.ad-config').findFirst({});
      if (!adConfig) {
        await strapi.documents('api::ad-config.ad-config').create({ data: {} });
        strapi.log.info('[bootstrap] ad-config 初始化空记录');
      }
    } catch (err) {
      strapi.log.warn(`[bootstrap] 初始化失败: ${(err as Error).message}`);
    }
  },
};
