import {
  CoolController,
  BaseController,
  CoolCommException,
} from '@cool-midway/core';
import { Files, Post } from '@midwayjs/core';
import { platformDefaults } from '../../../../config/platform';
import * as fs from 'fs';
import * as path from 'path';
import { pUploadPath } from '../../../../comm/path';
import { v4 as uuid } from 'uuid';

@CoolController()
export class AppGenerationUploadController extends BaseController {
  @Post('/temp', { summary: '上传参考媒体到临时目录' })
  async temp(@Files() files) {
    const file = files?.[0];
    if (!file) throw new CoolCommException('请选择文件');
    const size = file.data?.length || fs.statSync(file.data).size;
    if (size > platformDefaults.maxUploadBytes) {
      throw new CoolCommException(
        `文件不能超过 ${Math.floor(platformDefaults.maxUploadBytes / 1024 / 1024)}MB`
      );
    }
    const dir = path.join(pUploadPath(), 'temp');
    fs.mkdirSync(dir, { recursive: true });
    const ext = path.extname(file.filename || '') || '.bin';
    const name = `${uuid()}${ext}`;
    const target = path.join(dir, name);
    if (typeof file.data === 'string') {
      fs.copyFileSync(file.data, target);
    } else {
      fs.writeFileSync(target, file.data);
    }
    return this.ok({
      path: `/upload/temp/${name}`,
      name,
      size,
      expiresInHours: platformDefaults.tempFileTtlHours,
    });
  }
}
