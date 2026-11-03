<template>
	<cl-crud ref="Crud">
		<cl-row>
			<cl-refresh-btn />
			<cl-add-btn />
			<cl-multi-delete-btn />
			<cl-flex1 />
			<cl-search ref="Search" />
		</cl-row>
		<cl-row><cl-table ref="Table" /></cl-row>
		<cl-row><cl-flex1 /><cl-pagination /></cl-row>
		<cl-upsert ref="Upsert" />
	</cl-crud>
</template>

<script lang="ts" setup>
defineOptions({ name: 'model-channel' });
import { nextTick, onMounted } from 'vue';
import { useCrud, useSearch, useTable, useUpsert } from '@cool-vue/crud';
import { useCool } from '/@/cool';

const { service } = useCool();
const Crud = useCrud({ service: service.model.channel });
useSearch();
useTable({
	columns: [
		{ type: 'selection' },
		{ prop: 'id', label: 'ID', width: 80 },
		{ prop: 'name', label: '名称', minWidth: 120 },
		{ prop: 'baseUrl', label: 'Base URL', minWidth: 220 },
		{ prop: 'apiFormat', label: '格式', width: 100 },
		{ prop: 'enabled', label: '启用', width: 80 },
		{ type: 'op', buttons: ['edit', 'delete'] }
	]
});
useUpsert({
	items: [
		{ prop: 'name', label: '名称', required: true, component: { name: 'el-input' } },
		{ prop: 'baseUrl', label: 'Base URL', required: true, component: { name: 'el-input' } },
		{ prop: 'apiKey', label: 'API Key', component: { name: 'el-input', props: { type: 'password', showPassword: true, placeholder: '留空则不修改' } } },
		{ prop: 'apiFormat', label: '格式', value: 'openai', component: { name: 'el-input' } },
		{ prop: 'enabled', label: '启用', value: true, component: { name: 'el-switch' } },
		{ prop: 'callScript', label: '调用脚本(管理员)', component: { name: 'el-input', props: { type: 'textarea', rows: 6 } } }
	]
});
// 等 cl-table 挂上 crud.refresh 监听后再拉数，避免本地接口过快导致首屏空表
onMounted(() => nextTick(() => Crud.value?.refresh()));
</script>
