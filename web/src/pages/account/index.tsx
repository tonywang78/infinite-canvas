import { App, Button, Form, Input, Table, Tabs, Tag } from "antd";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ConfigLocalStorage } from "@/components/layout/config-local-storage";
import { AccountPreferencesForm } from "@/pages/account/preferences-form";
import { platformApi } from "@/services/api/platform";
import { useAuthStore } from "@/stores/use-auth-store";

export default function AccountPage() {
    const { message } = App.useApp();
    const navigate = useNavigate();
    const { user, balance, refreshProfile, logout, ready } = useAuthStore();
    const [ledger, setLedger] = useState<any[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState("preferences");

    useEffect(() => {
        if (!ready) return;
        if (!user) {
            navigate("/login");
            return;
        }
        void refreshProfile();
        void platformApi
            .ledger()
            .then((res) => setLedger(res.list || []))
            .catch(() => undefined);
        void platformApi
            .tasks()
            .then((res) => setTasks(res.list || []))
            .catch(() => undefined);
    }, [ready, user, navigate, refreshProfile]);

    if (!user) return null;

    return (
        <main className="mx-auto max-w-5xl px-6 py-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-semibold">账户中心</h1>
                    <p className="mt-2 text-stone-500">
                        {user.nickName || user.email || user.phone} · 余额 <span className="font-medium text-stone-900 dark:text-stone-100">{balance}</span> 积分
                    </p>
                </div>
                <Button
                    onClick={() => {
                        logout();
                        navigate("/login");
                    }}
                >
                    退出登录
                </Button>
            </div>

            <Tabs
                className="mt-8"
                activeKey={activeTab}
                onChange={setActiveTab}
                items={[
                    {
                        key: "preferences",
                        label: "个人偏好",
                        children: <AccountPreferencesForm />,
                    },
                    {
                        key: "local-storage",
                        label: "本地存储",
                        children: <ConfigLocalStorage active={activeTab === "local-storage"} />,
                    },
                    {
                        key: "redeem",
                        label: "兑换码",
                        children: (
                            <Form
                                layout="inline"
                                onFinish={async (values) => {
                                    try {
                                        const res = await platformApi.redeem(values.code);
                                        message.success(`已到账 ${res.points} 积分`);
                                        await refreshProfile();
                                        const next = await platformApi.ledger();
                                        setLedger(next.list || []);
                                    } catch (error) {
                                        message.error(error instanceof Error ? error.message : "兑换失败");
                                    }
                                }}
                            >
                                <Form.Item name="code" rules={[{ required: true, message: "请输入兑换码" }]}>
                                    <Input placeholder="输入兑换码" />
                                </Form.Item>
                                <Button type="primary" htmlType="submit">
                                    兑换
                                </Button>
                            </Form>
                        ),
                    },
                    {
                        key: "ledger",
                        label: "积分流水",
                        children: (
                            <Table
                                rowKey="id"
                                dataSource={ledger}
                                pagination={false}
                                columns={[
                                    { title: "类型", dataIndex: "type", width: 100 },
                                    { title: "变动", dataIndex: "delta", width: 100 },
                                    { title: "余额", dataIndex: "balanceAfter", width: 100 },
                                    { title: "原因", dataIndex: "reason" },
                                    { title: "时间", dataIndex: "createTime", width: 180 },
                                ]}
                            />
                        ),
                    },
                    {
                        key: "tasks",
                        label: "生成任务",
                        children: (
                            <Table
                                rowKey="id"
                                dataSource={tasks}
                                pagination={false}
                                columns={[
                                    { title: "类型", dataIndex: "kind", width: 90 },
                                    {
                                        title: "状态",
                                        dataIndex: "status",
                                        width: 110,
                                        render: (value: string) => <Tag>{value}</Tag>,
                                    },
                                    { title: "预扣", dataIndex: "holdPoints", width: 90 },
                                    { title: "实扣", dataIndex: "settledPoints", width: 90 },
                                    { title: "错误", dataIndex: "errorMessage" },
                                    {
                                        title: "操作",
                                        width: 100,
                                        render: (_, row) =>
                                            ["holding", "running"].includes(row.status) ? (
                                                <Button
                                                    size="small"
                                                    onClick={async () => {
                                                        await platformApi.cancelTask(row.id);
                                                        message.success("已取消");
                                                        const next = await platformApi.tasks();
                                                        setTasks(next.list || []);
                                                        await refreshProfile();
                                                    }}
                                                >
                                                    取消
                                                </Button>
                                            ) : null,
                                    },
                                ]}
                            />
                        ),
                    },
                    {
                        key: "bind",
                        label: "补绑账号",
                        children: (
                            <Form
                                layout="inline"
                                onFinish={async (values) => {
                                    try {
                                        await platformApi.bindAccount(values.account);
                                        message.success("绑定成功");
                                        await refreshProfile();
                                    } catch (error) {
                                        message.error(error instanceof Error ? error.message : "绑定失败");
                                    }
                                }}
                            >
                                <Form.Item name="account" rules={[{ required: true, message: "请输入邮箱或手机号" }]}>
                                    <Input placeholder="补绑另一种登录方式" />
                                </Form.Item>
                                <Button htmlType="submit">绑定</Button>
                            </Form>
                        ),
                    },
                ]}
            />

            <p className="mt-8 text-sm text-stone-500">
                <Link to="/legal/terms">用户协议</Link> · <Link to="/legal/privacy">隐私政策</Link>
            </p>
        </main>
    );
}
