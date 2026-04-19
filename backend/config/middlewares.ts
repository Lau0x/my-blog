import type { Core } from '@strapi/strapi';

// 上传总上限 800MB（覆盖短视频、长图、PDF 等常见大文件）
// Strapi 5 的上传走两层：Koa body parser（这里）+ upload plugin（见 plugins.ts）
const MAX_UPLOAD_BYTES = 800 * 1024 * 1024;

const config: Core.Config.Middlewares = [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  'strapi::cors',
  'strapi::poweredBy',
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      formLimit: '800mb',
      jsonLimit: '800mb',
      textLimit: '800mb',
      formidable: {
        maxFileSize: MAX_UPLOAD_BYTES,
      },
    },
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];

export default config;
