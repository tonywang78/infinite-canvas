<template>
	<cl-crud ref="Crud">
		<cl-row>
			<cl-refresh-btn />
			<el-button type="primary" @click="openTopup">手动入账</el-button>
			<el-button @click="openAdjust">人工调整</el-button>
			<cl-flex1 />
			<cl-search ref="Search" />
		</cl-row>
		<cl-row><cl-table ref="Table" /></cl-row>
		<cl-row><cl-flex1 /><cl-pagination /></cl-row>
	</cl-crud>
</template>

<script lang="ts" setup>
defineOptions({ name: 'credit-ledger' });
import { nextTick, onMounted } from 'vue';
import { useCrud, useSearch, useTable } from '@cool-vue/crud';
import { useCool } from '/@/cool';
import { ElMessage, ElMessageBox } from 'element-plus';

const { service } = useCool();
const Crud = useCrud({ service: service.credit.ledger });
const Search = useSearch();
const Table = useTable({
	columns: [
		{ prop: 'id', label: 'ID', width: 80 },
		{ prop: 'userId', label: '用户ID', width: 100 },
		{ prop: 'type', label: '类型', width: 100 },
		{ prop: 'delta', label: '变动', width: 100 },
		{ prop: 'balanceAfter', label: '余额', width: 100 },
		{ prop: 'reason', label: '原因', minWidth: 160 },
		{ prop: 'createTime', label: '时间', minWidth: 160 }
	]
});

async function openTopup() {
	const { value } = await ElMessageBox.prompt('格式：用户ID,积分,原因', '手动入账');
	const [userId, points, reason] = value.split(',');
	await service.credit.ledger.topup({ userId: Number(userId), points: Number(points), reason });
	ElMessage.success('入账成功');
	Crud.value?.refresh();
}

async function openAdjust() {
	const { value } = await ElMessageBox.prompt('格式：用户ID,增减积分(可为负),原因', '人工调整');
	const [userId, delta, reason] = value.split(',');
	await service.credit.ledger.adjust({ userId: Number(userId), delta: Number(delta), reason });
	ElMessage.success('调整成功');
	Crud.value?.refresh();
}
onMounted(() => nextTick(() => Crud.value?.refresh()));
</script>
