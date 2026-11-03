import { CoolConfig } from '@cool-midway/core';
import { MidwayConfig } from '@midwayjs/core';
import { TenantSubscriber } from '../modules/base/db/tenant';

/**
 * 本地开发 npm run dev 读取的配置文件
 */
export default {
  typeorm: {
    dataSource: {
      default: {
        type: 'postgres',
        host: process.env.DB_HOST || '127.0.0.1',
        // 与 server/docker-compose.yml 宿主机映射一致（容器内仍是 5432）
        port: Number(process.env.DB_PORT || 5433),
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '123456',
        database: process.env.DB_NAME || 'infinite_canvas',
        synchronize: true,
        logging: false,
        cache: true,
        entities: ['**/modules/*/entity'],
        subscribers: [TenantSubscriber],
      },
    },
  },
  cool: {
    eps: true,
    initDB: true,
    initJudge: 'db',
    initMenu: true,
  } as CoolConfig,
} as MidwayConfig;
