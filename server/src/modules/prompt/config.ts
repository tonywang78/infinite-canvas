import { ModuleConfig } from '@cool-midway/core';

export default () => {
  return {
    name: '提示词同步',
    description: '平台提示词来源与同步',
    middlewares: [],
    globalMiddlewares: [],
    order: 0,
  } as ModuleConfig;
};
