import { App, Button, Checkbox, Form, Input } from "antd";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { CaptchaButton } from "@/pages/auth/captcha-button";
import { platformApi } from "@/services/api/platform";
import { useAuthStore } from "@/stores/use-auth-store";

export default function RegisterPage() {
    const { message } = App.useApp();
    const navigate = useNavigate();
    const applyToken = useAuthStore((s) => s.applyToken);
    const [captcha, setCaptcha] = useState<{ captchaId: string; data: string } | null>(null);
    const [gift, setGift] = useState(100);
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
        void platformApi.sitePublic().then((cfg) => setGift(cfg.registerGiftPoints)).catch(() => undefined);
    }, []);

    return (
        <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-16">
            <h1 className="text-3xl font-semibold">注册</h1>
            <p className="mt-2 text-sm text-stone-500">新用户注册赠送 {gift} 积分</p>
            <Form
                className="mt-8"
                layout="vertical"
                onFinish={async (values) => {
                    if (!values.agree) {
                        message.warning("请先同意用户协议与隐私政策");
                        return;
                    }
                    setLoading(true);
                    try {
                        const token = await platformApi.register({
                            account: values.account,
                            password: values.password,
                            captchaId: captcha?.captchaId || "",
                            code: values.code,
                        });
                        await applyToken(token);
                        message.success("注册成功");
                        navigate("/account");
                    } catch (error) {
                        message.error(error instanceof Error ? error.message : "注册失败");
                        void loadCaptcha();
                    } finally {
                        setLoading(false);
                    }
                }}
            >
                <Form.Item name="account" label="邮箱 / 手机号" rules={[{ required: true, message: "请输入账号" }]}>
                    <Input size="large" />
                </Form.Item>
                <Form.Item name="password" label="密码" rules={[{ required: true, min: 8, message: "密码至少 8 位" }]}>
                    <Input.Password size="large" />
                </Form.Item>
                <Form.Item name="code" label="验证码" rules={[{ required: true, message: "请输入验证码" }]}>
                    <div className="flex gap-3">
                        <Input size="large" className="flex-1" />
                        <CaptchaButton data={captcha?.data} onRefresh={() => void loadCaptcha()} />
                    </div>
                </Form.Item>
                <Form.Item name="agree" valuePropName="checked">
                    <Checkbox>
                        我已阅读并同意 <Link to="/legal/terms">用户协议</Link> 与 <Link to="/legal/privacy">隐私政策</Link>
                    </Checkbox>
                </Form.Item>
                <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                    注册
                </Button>
            </Form>
            <div className="mt-6 text-sm">
                已有账号？ <Link to="/login">去登录</Link>
            </div>
        </main>
    );
}
