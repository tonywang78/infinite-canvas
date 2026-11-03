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
defineOptions({ name: 'model-offer' });
import { nextTick, onMounted, reactive } from 'vue';
import { useCrud, useSearch, useTable, useUpsert } from '@cool-vue/crud';
import { useCool } from '/@/cool';

const { service } = useCool();
const Crud = useCrud({ service: service.model.offer });

const channelOptions = reactive<{ label: string; value: number }[]>([]);

async function loadChannels() {
	const list = (await service.model.channel.list()) || [];
	const options = list.map((e: any) => ({
		label: e.enabled === false ? `${e.name}（未启用）` : e.name,
		value: e.id
	}));
	channelOptions.splice(0, channelOptions.length, ...options);
	Upsert.value?.setOptions('channelId', options);
}

useSearch({
	items: [
		{
			prop: 'channelId',
			label: '上游渠道',
			component: {
				name: 'el-select',
				options: channelOptions,
				props: { clearable: true, filterable: true, placeholder: '全部渠道' }
			}
		}
	]
});
useTable({
	columns: [
		{ type: 'selection' },
		{ prop: 'id', label: 'ID', width: 80 },
		{ prop: 'channelId', label: '上游渠道', minWidth: 160, dict: channelOptions },
		{ prop: 'capability', label: '能力', width: 100 },
		{ prop: 'displayName', label: '展示名', minWidth: 140 },
		{ prop: 'modelName', label: '模型名', minWidth: 140 },
		{ prop: 'enabled', label: '启用', width: 80 },
		{ prop: 'sort', label: '排序', width: 80 },
		{ type: 'op', buttons: ['edit', 'delete'] }
	]
});
const Upsert = useUpsert({
	items: [
		{
			prop: 'channelId',
			label: '上游渠道',
			required: true,
			component: {
				name: 'el-select',
				options: channelOptions,
				props: {
					filterable: true,
					placeholder: '请选择上游渠道'
				}
			}
		},
		{
			prop: 'capability',
			label: '能力',
			required: true,
			component: {
				name: 'el-select',
				options: [
					{ label: 'image', value: 'image' },
					{ label: 'edit', value: 'edit' },
					{ label: 'text', value: 'text' },
					{ label: 'audio', value: 'audio' },
					{ label: 'video', value: 'video' }
				]
			}
		},
		{ prop: 'displayName', label: '展示名', required: true, component: { name: 'el-input' } },
		{ prop: 'modelName', label: '模型名', required: true, component: { name: 'el-input' } },
		{ prop: 'enabled', label: '启用', value: true, component: { name: 'el-switch' } },
		{ prop: 'sort', label: '排序', value: 0, component: { name: 'el-input-number' } }
	],
	async onOpen() {
		await loadChannels();
	}
});
onMounted(() =>
	nextTick(async () => {
		await loadChannels();
		Crud.value?.refresh();
	})
);
</script>
