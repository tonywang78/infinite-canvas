import { App, Button, Form, Input } from "antd";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { CaptchaButton } from "@/pages/auth/captcha-button";
import { platformApi } from "@/services/api/platform";

export default function ForgotPasswordPage() {
    const { message } = App.useApp();
    const [captcha, setCaptcha] = useState<{ captchaId: string; data: string } | null>(null);
    const [loading, setLoading] = useState(false);

    const loadCaptcha = async () => {
        setCaptcha(await platformApi.captcha());
    };

    useEffect(() => {
        void loadCaptcha().catch(() => undefined);
    }, []);

    return (
        <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-16">
            <h1 className="text-3xl font-semibold">找回密码</h1>
            <p className="mt-2 text-sm text-stone-500">仅支持已绑定邮箱的账号。未配置邮件服务时请联系管理员协助重置。</p>
            <Form
                className="mt-8"
                layout="vertical"
                onFinish={async (values) => {
                    setLoading(true);
                    try {
                        await platformApi.forgot({
                            email: values.email,
                            captchaId: captcha?.captchaId || "",
                            code: values.code,
                        });
                        message.success("如果邮箱存在，重置请求已受理");
                    } catch (error) {
                        message.error(error instanceof Error ? error.message : "提交失败");
                        void loadCaptcha();
                    } finally {
                        setLoading(false);
                    }
                }}
            >
                <Form.Item name="email" label="邮箱" rules={[{ required: true, type: "email" }]}>
                    <Input size="large" />
                </Form.Item>
                <Form.Item name="code" label="验证码" rules={[{ required: true }]}>
                    <div className="flex gap-3">
                        <Input size="large" className="flex-1" />
                        <CaptchaButton data={captcha?.data} onRefresh={() => void loadCaptcha()} />
                    </div>
                </Form.Item>
                <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                    提交
                </Button>
            </Form>
            <div className="mt-6 text-sm">
                <Link to="/login">返回登录</Link>
            </div>
        </main>
    );
}
