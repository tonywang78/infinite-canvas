<template>
	<cl-crud ref="Crud">
		<cl-row>
			<cl-refresh-btn />
			<cl-add-btn />
			<cl-multi-delete-btn />
			<el-button type="primary" @click="syncAll">同步全部</el-button>
			<cl-flex1 />
			<cl-search ref="Search" />
		</cl-row>
		<cl-row><cl-table ref="Table" /></cl-row>
		<cl-row><cl-flex1 /><cl-pagination /></cl-row>
		<cl-upsert ref="Upsert" />
	</cl-crud>
</template>

<script lang="ts" setup>
defineOptions({ name: 'prompt-source' });
import { nextTick, onMounted } from 'vue';
import { useCrud, useSearch, useTable, useUpsert } from '@cool-vue/crud';
import { useCool } from '/@/cool';
import { ElMessage } from 'element-plus';

const { service } = useCool();
const Crud = useCrud({ service: service.prompt.source });
useSearch();
useTable({
	columns: [
		{ type: 'selection' },
		{ prop: 'id', label: 'ID', width: 80 },
		{ prop: 'name', label: '名称', minWidth: 140 },
		{ prop: 'url', label: 'JSON 地址', minWidth: 220 },
		{ prop: 'enabled', label: '启用', width: 80 },
		{ prop: 'sort', label: '排序', width: 80 },
		{
			type: 'op',
			width: 200,
			buttons: [
				'edit',
				'delete',
				{
					label: '同步',
					async onClick({ scope }) {
						await service.prompt.source.sync({ sourceId: scope.row.id });
						ElMessage.success('同步完成');
					}
				}
			]
		}
	]
});
useUpsert({
	items: [
		{ prop: 'name', label: '名称', required: true, component: { name: 'el-input' } },
		{ prop: 'url', label: 'JSON 地址', required: true, component: { name: 'el-input' } },
		{ prop: 'homepage', label: '主页(仅后台)', component: { name: 'el-input' } },
		{ prop: 'enabled', label: '启用', value: true, component: { name: 'el-switch' } },
		{ prop: 'builtIn', label: '内置', value: false, component: { name: 'el-switch' } },
		{ prop: 'sort', label: '排序', value: 0, component: { name: 'el-input-number' } }
	]
});

async function syncAll() {
	await service.prompt.source.sync({});
	ElMessage.success('已触发全量同步');
	Crud.value?.refresh();
}
onMounted(() => nextTick(() => Crud.value?.refresh()));
</script>
