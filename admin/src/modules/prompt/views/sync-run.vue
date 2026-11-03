<template>
	<cl-crud ref="Crud">
		<cl-row>
			<cl-refresh-btn />
			<cl-flex1 />
			<cl-search ref="Search" />
		</cl-row>
		<cl-row><cl-table ref="Table" /></cl-row>
		<cl-row><cl-flex1 /><cl-pagination /></cl-row>
	</cl-crud>
</template>

<script lang="ts" setup>
defineOptions({ name: 'prompt-sync-run' });
import { nextTick, onMounted } from 'vue';
import { useCrud, useSearch, useTable } from '@cool-vue/crud';
import { useCool } from '/@/cool';

const { service } = useCool();
const Crud = useCrud({
	service: (service.prompt as any).sync_run || (service.prompt as any)['sync-run']
});
useSearch();
useTable({
	columns: [
		{ prop: 'id', label: 'ID', width: 80 },
		{ prop: 'sourceId', label: '来源', width: 90 },
		{ prop: 'trigger', label: '触发', width: 90 },
		{ prop: 'status', label: '状态', width: 100 },
		{ prop: 'message', label: '信息', minWidth: 200 },
		{ prop: 'createTime', label: '时间', minWidth: 160 }
	]
});
onMounted(() => nextTick(() => Crud.value?.refresh()));
</script>
