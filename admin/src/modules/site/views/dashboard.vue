<template>
	<div class="p-4">
		<el-row :gutter="16">
			<el-col :span="6"><el-card><div>今日注册</div><div class="text-2xl">{{ data.todayRegistrations }}</div></el-card></el-col>
			<el-col :span="6"><el-card><div>今日消耗积分</div><div class="text-2xl">{{ data.todaySpentPoints }}</div></el-card></el-col>
			<el-col :span="6"><el-card><div>进行中任务</div><div class="text-2xl">{{ data.runningTasks }}</div></el-card></el-col>
			<el-col :span="6"><el-card><div>今日上游失败</div><div class="text-2xl">{{ data.todayFailures }}</div></el-card></el-col>
		</el-row>
		<el-button class="mt-4" @click="load">刷新</el-button>
	</div>
</template>

<script lang="ts" setup>
defineOptions({ name: 'site-dashboard' });
import { onMounted, reactive } from 'vue';
import { useCool } from '/@/cool';

const { service } = useCool();
const data = reactive({
	todayRegistrations: 0,
	todaySpentPoints: 0,
	runningTasks: 0,
	todayFailures: 0
});

async function load() {
	Object.assign(data, await service.site.setting.dashboard());
}

onMounted(load);
</script>
