<template>
	<div class="p-3">
		<el-card class="mb-3">
			<template #header>日对账</template>
			<el-space>
				<el-date-picker v-model="day" type="date" value-format="YYYY-MM-DD" />
				<el-button type="primary" @click="loadRecon">查询</el-button>
				<el-button @click="releaseTimedOut">释放超时预扣</el-button>
			</el-space>
			<pre class="mt-3 text-sm">{{ recon }}</pre>
		</el-card>
		<cl-crud ref="Crud">
			<cl-row>
				<cl-refresh-btn />
				<cl-flex1 />
				<cl-search ref="Search" />
			</cl-row>
			<cl-row><cl-table ref="Table" /></cl-row>
			<cl-row><cl-flex1 /><cl-pagination /></cl-row>
		</cl-crud>
	</div>
</template>

<script lang="ts" setup>
defineOptions({ name: 'generation-task' });
import { nextTick, onMounted, ref } from 'vue';
import { useCrud, useSearch, useTable } from '@cool-vue/crud';
import { useCool } from '/@/cool';
import { ElMessage } from 'element-plus';
import dayjs from 'dayjs';

const { service } = useCool();
const day = ref(dayjs().format('YYYY-MM-DD'));
const recon = ref('');
const Crud = useCrud({ service: service.generation.task });
useSearch();
useTable({
	columns: [
		{ prop: 'id', label: 'ID', width: 80 },
		{ prop: 'userId', label: '用户', width: 90 },
		{ prop: 'kind', label: '类型', width: 90 },
		{ prop: 'status', label: '状态', width: 100 },
		{ prop: 'holdPoints', label: '预扣', width: 90 },
		{ prop: 'settledPoints', label: '实扣', width: 90 },
		{ prop: 'vendorRequestId', label: '上游单号', minWidth: 140 },
		{ prop: 'errorMessage', label: '错误', minWidth: 180 },
		{ prop: 'createTime', label: '创建时间', minWidth: 160 }
	]
});

async function loadRecon() {
	recon.value = JSON.stringify(await service.generation.task.reconciliation({ day: day.value }), null, 2);
}

async function releaseTimedOut() {
	const res = await service.generation.task.releaseTimedOut();
	ElMessage.success(`已处理 ${res.count || 0} 个超时任务`);
}
onMounted(() => nextTick(() => Crud.value?.refresh()));
</script>
