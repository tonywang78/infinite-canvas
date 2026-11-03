import { App, Button, Form, Input } from "antd";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { CaptchaButton } from "@/pages/auth/captcha-button";
import { platformApi } from "@/services/api/platform";
import { useAuthStore } from "@/stores/use-auth-store";

export default function LoginPage() {
    const { message } = App.useApp();
    const navigate = useNavigate();
    const applyToken = useAuthStore((s) => s.applyToken);
    const [captcha, setCaptcha] = useState<{ captchaId: string; data: string } | null>(null);
    const [loading, setLoading] = useState(false);

    const loadCaptcha = async () => {
        try {
            setCaptcha(await platformApi.captcha());
        } catch (error) {
            message.error(error instanceof Error ? error.message : "验证码加载失败");
        }
    };

    useEffect(() => {
        void loadCaptcha();
    }, []);

    return (
        <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-16">
            <h1 className="text-3xl font-semibold">登录</h1>
            <p className="mt-2 text-sm text-stone-500">使用邮箱或手机号 + 密码登录</p>
            <Form
                className="mt-8"
                layout="vertical"
                onFinish={async (values) => {
                    setLoading(true);
                    try {
                        const token = await platformApi.login({
                            account: values.account,
                            password: values.password,
                            captchaId: captcha?.captchaId,
                            code: values.code,
                        });
                        await applyToken(token);
                        message.success("登录成功");
                        navigate("/account");
                    } catch (error) {
                        message.error(error instanceof Error ? error.message : "登录失败");
                        void loadCaptcha();
                    } finally {
                        setLoading(false);
                    }
                }}
            >
                <Form.Item name="account" label="邮箱 / 手机号" rules={[{ required: true, message: "请输入账号" }]}>
                    <Input size="large" placeholder="name@example.com 或 11 位手机号" />
                </Form.Item>
                <Form.Item name="password" label="密码" rules={[{ required: true, message: "请输入密码" }]}>
                    <Input.Password size="large" />
                </Form.Item>
                <Form.Item name="code" label="验证码" rules={[{ required: true, message: "请输入验证码" }]}>
                    <div className="flex gap-3">
                        <Input size="large" className="flex-1" />
                        <CaptchaButton data={captcha?.data} onRefresh={() => void loadCaptcha()} />
                    </div>
                </Form.Item>
                <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                    登录
                </Button>
            </Form>
            <div className="mt-6 flex justify-between text-sm">
                <Link to="/register">注册账号</Link>
                <Link to="/forgot-password">忘记密码</Link>
            </div>
        </main>
    );
}
