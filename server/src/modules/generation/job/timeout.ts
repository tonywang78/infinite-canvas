import { Job, IJob } from '@midwayjs/cron';
import { FORMAT, Inject } from '@midwayjs/core';
import { GenerationTaskService } from '../service/task';

@Job({
  cronTime: FORMAT.CRONTAB.EVERY_MINUTE,
  start: true,
})
export class GenerationTimeoutJob implements IJob {
  @Inject()
  generationTaskService: GenerationTaskService;

  async onTick() {
    await this.generationTaskService.releaseTimedOut();
  }
}
