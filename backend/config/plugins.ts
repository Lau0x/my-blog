import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  // Upload plugin：允许单文件 800MB（短视频、长图、PDF 等）
  // 配合 middlewares.ts 里 strapi::body 的 formidable.maxFileSize，两层都要改
  upload: {
    config: {
      sizeLimit: 800 * 1024 * 1024,
    },
  },
});

export default config;
