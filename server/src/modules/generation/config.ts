import { ModuleConfig } from '@cool-midway/core';

export default () => {
  return {
    name: '生成任务',
    description: '平台代理生成、预扣结算与对账',
    middlewares: [],
    globalMiddlewares: [],
    order: 0,
  } as ModuleConfig;
};
