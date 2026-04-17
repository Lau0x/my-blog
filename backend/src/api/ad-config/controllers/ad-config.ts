import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::ad-config.ad-config', ({ strapi }) => ({
  async find(ctx) {
    ctx.query = {
      ...ctx.query,
      populate: {
        homeTopBanner: { populate: '*' },
        homeBottomCard: { populate: '*' },
        articleTopBanner: { populate: '*' },
        articleBottomCard: { populate: '*' },
      },
    };
    return await super.find(ctx);
  },
}));
