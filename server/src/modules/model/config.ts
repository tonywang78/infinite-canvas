import { ModuleConfig } from '@cool-midway/core';

export default () => {
  return {
    name: '模型渠道',
    description: '上游渠道、模型能力与积分价目',
    middlewares: [],
    globalMiddlewares: [],
    order: 0,
  } as ModuleConfig;
};
