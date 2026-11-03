/**
 * 平台边界默认值（实现前已在计划中约定：上线前可按环境变量覆盖）。
 * 变更这些会改变实际计费与限流行为，部署前请确认。
 */
export const platformDefaults = {
  /** 新用户注册赠送积分 */
  registerGiftPoints: Number(process.env.REGISTER_GIFT_POINTS || 100),
  /** 单用户同时进行中的生成任务上限 */
  maxConcurrentTasks: Number(process.env.MAX_CONCURRENT_TASKS || 3),
  /** 参考图等上传大小上限（字节） */
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES || 20 * 1024 * 1024),
  /** 任务超时后自动释放预扣（毫秒） */
  taskTimeoutMs: Number(process.env.TASK_TIMEOUT_MS || 10 * 60 * 1000),
  /** 临时上传文件保留小时数 */
  tempFileTtlHours: Number(process.env.TEMP_FILE_TTL_HOURS || 24),
  /** 登录失败锁定阈值 */
  loginFailLimit: Number(process.env.LOGIN_FAIL_LIMIT || 5),
  /** 登录失败锁定时长（秒） */
  loginLockSeconds: Number(process.env.LOGIN_LOCK_SECONDS || 15 * 60),
  /** 渠道 API Key 加密密钥（至少 32 字符） */
  secretsMasterKey:
    process.env.SECRETS_MASTER_KEY ||
    'infinite-canvas-dev-master-key-change-me!!',
};
