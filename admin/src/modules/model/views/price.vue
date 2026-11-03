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
defineOptions({ name: 'model-price' });
import { nextTick, onMounted, reactive } from 'vue';
import { useCrud, useSearch, useTable, useUpsert } from '@cool-vue/crud';
import { useCool } from '/@/cool';

const { service } = useCool();
const Crud = useCrud({ service: service.model.price });

const offerOptions = reactive<{ label: string; value: number }[]>([]);

async function loadOffers() {
	const list = (await service.model.offer.list()) || [];
	const options = list
		.slice()
		.sort((a: any, b: any) => (a.sort ?? 0) - (b.sort ?? 0) || a.id - b.id)
		.map((e: any) => ({
			label: e.enabled === false
				? `${e.displayName}（${e.capability} / ${e.modelName}）（未启用）`
				: `${e.displayName}（${e.capability} / ${e.modelName}）`,
			value: e.id
		}));
	offerOptions.splice(0, offerOptions.length, ...options);
	Upsert.value?.setOptions('offerId', options);
}

useSearch({
	items: [
		{
			prop: 'offerId',
			label: '模型',
			component: {
				name: 'el-select',
				options: offerOptions,
				props: { clearable: true, filterable: true, placeholder: '全部模型' }
			}
		}
	]
});
useTable({
	columns: [
		{ type: 'selection' },
		{ prop: 'id', label: 'ID', width: 80 },
		{ prop: 'offerId', label: '模型', minWidth: 220, dict: offerOptions },
		{ prop: 'unit', label: '单位', width: 120 },
		{ prop: 'points', label: '积分', width: 100 },
		{ prop: 'enabled', label: '启用', width: 80 },
		{ type: 'op', buttons: ['edit', 'delete'] }
	]
});
const Upsert = useUpsert({
	items: [
		{
			prop: 'offerId',
			label: '模型',
			required: true,
			component: {
				name: 'el-select',
				options: offerOptions,
				props: {
					filterable: true,
					placeholder: '请选择模型能力'
				}
			}
		},
		{
			prop: 'unit',
			label: '单位',
			value: 'per_request',
			component: {
				name: 'el-select',
				options: [
					{ label: 'per_request', value: 'per_request' },
					{ label: 'per_image', value: 'per_image' },
					{ label: 'per_second', value: 'per_second' },
					{ label: 'per_1k_tokens', value: 'per_1k_tokens' }
				]
			}
		},
		{ prop: 'points', label: '积分', required: true, component: { name: 'el-input-number' } },
		{ prop: 'enabled', label: '启用', value: true, component: { name: 'el-switch' } }
	],
	async onOpen() {
		await loadOffers();
	}
});
onMounted(() =>
	nextTick(async () => {
		await loadOffers();
		Crud.value?.refresh();
	})
);
</script>
