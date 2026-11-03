<template>
	<div class="p-4 max-w-xl">
		<el-form label-width="140px">
			<el-form-item label="开放注册">
				<el-switch v-model="form.registerEnabled" />
			</el-form-item>
			<el-form-item label="维护模式">
				<el-switch v-model="form.maintenanceMode" />
			</el-form-item>
			<el-form-item label="注册赠送积分">
				<el-input-number v-model="form.registerGiftPoints" :min="0" />
			</el-form-item>
			<el-form-item label="公告">
				<el-input v-model="form.announcement" type="textarea" :rows="4" />
			</el-form-item>
			<el-button type="primary" @click="save">保存</el-button>
		</el-form>
	</div>
</template>

<script lang="ts" setup>
defineOptions({ name: 'site-setting' });
import { onMounted, reactive } from 'vue';
import { useCool } from '/@/cool';
import { ElMessage } from 'element-plus';

const { service } = useCool();
const form = reactive({
	registerEnabled: true,
	maintenanceMode: false,
	registerGiftPoints: 100,
	announcement: ''
});

async function load() {
	const map = await service.site.setting.map();
	form.registerEnabled = map.registerEnabled !== 'false';
	form.maintenanceMode = map.maintenanceMode === 'true';
	form.registerGiftPoints = Number(map.registerGiftPoints || 100);
	form.announcement = map.announcement || '';
}

async function save() {
	await service.site.setting.set({ key: 'registerEnabled', value: String(form.registerEnabled) });
	await service.site.setting.set({ key: 'maintenanceMode', value: String(form.maintenanceMode) });
	await service.site.setting.set({ key: 'registerGiftPoints', value: String(form.registerGiftPoints) });
	await service.site.setting.set({ key: 'announcement', value: form.announcement });
	ElMessage.success('已保存');
}

onMounted(load);
</script>
