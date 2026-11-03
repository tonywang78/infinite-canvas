import { ModuleConfig } from '@cool-midway/core';

export default () => {
  return {
    name: '站点配置',
    description: '注册开关、公告、注册赠送等',
    middlewares: [],
    globalMiddlewares: [],
    order: 0,
  } as ModuleConfig;
};
