<template>
	<cl-crud ref="Crud">
		<cl-row>
			<cl-refresh-btn />
			<el-button type="primary" @click="createCodes">生成兑换码</el-button>
			<cl-flex1 />
			<cl-search ref="Search" />
		</cl-row>
		<cl-row><cl-table ref="Table" /></cl-row>
		<cl-row><cl-flex1 /><cl-pagination /></cl-row>
	</cl-crud>
</template>

<script lang="ts" setup>
defineOptions({ name: 'credit-redeem' });
import { nextTick, onMounted } from 'vue';
import { useCrud, useSearch, useTable } from '@cool-vue/crud';
import { useCool } from '/@/cool';
import { ElMessage, ElMessageBox } from 'element-plus';

const { service } = useCool();
const Crud = useCrud({ service: service.credit.redeem });
const Search = useSearch();
const Table = useTable({
	columns: [
		{ prop: 'id', label: 'ID', width: 80 },
		{ prop: 'code', label: '兑换码', minWidth: 160 },
		{ prop: 'points', label: '积分', width: 100 },
		{ prop: 'status', label: '状态', width: 100 },
		{ prop: 'usedBy', label: '使用者', width: 100 },
		{ prop: 'usedAt', label: '使用时间', minWidth: 160 },
		{
			type: 'op',
			buttons: [
				{
					label: '作废',
					async onClick({ scope }) {
						await service.credit.redeem.void({ id: scope.row.id });
						ElMessage.success('已作废');
						Crud.value?.refresh();
					}
				}
			]
		}
	]
});

async function createCodes() {
	const { value } = await ElMessageBox.prompt('格式：积分,数量', '生成兑换码');
	const [points, count] = value.split(',');
	await service.credit.redeem.createCodes({ points: Number(points), count: Number(count) });
	ElMessage.success('已生成');
	Crud.value?.refresh();
}
onMounted(() => nextTick(() => Crud.value?.refresh()));
</script>
