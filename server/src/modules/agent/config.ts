import { ModuleConfig } from '@cool-midway/core';

export default () => {
  return {
    name: '画布对话',
    description: '平台文本模型驱动的画布对话与工具调用',
    middlewares: [],
    globalMiddlewares: [],
    order: 0,
  } as ModuleConfig;
};
