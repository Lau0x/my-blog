import type { StrapiApp } from '@strapi/strapi/admin';

export default {
  config: {
    locales: ['zh-Hans'],
  },
  bootstrap(app: StrapiApp) {
    console.log(app);
  },
};
