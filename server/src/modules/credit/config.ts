import { ModuleConfig } from '@cool-midway/core';

export default () => {
  return {
    name: '积分账本',
    description: '积分流水、兑换码、人工调整',
    middlewares: [],
    globalMiddlewares: [],
    order: 0,
  } as ModuleConfig;
};
