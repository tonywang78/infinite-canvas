import { CoolConfig } from '@cool-midway/core';
import { MidwayConfig } from '@midwayjs/core';
import { entities } from '../entities';
import { TenantSubscriber } from '../modules/base/db/tenant';

/**
 * 生产环境配置
 */
export default {
  typeorm: {
    dataSource: {
      default: {
        type: 'postgres',
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 5432),
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '123456',
        database: process.env.DB_NAME || 'infinite_canvas',
        // Docker 首次启动可设 DB_SYNC=true；稳定后请关闭
        synchronize: process.env.DB_SYNC === 'true',
        logging: false,
        cache: true,
        entities,
        subscribers: [TenantSubscriber],
      },
    },
  },
  cool: {
    eps: false,
    // Docker 首次可设 DB_INIT=true 导入菜单/基础数据
    initDB: process.env.DB_INIT === 'true',
    initJudge: 'db',
    initMenu: process.env.DB_INIT === 'true',
  } as CoolConfig,
} as MidwayConfig;
