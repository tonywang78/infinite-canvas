import { ArrowRight, ImagePlus, Layers3, Sparkles, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "antd";
import { Link, useNavigate } from "react-router-dom";
import { platformApi } from "@/services/api/platform";
import { useAuthStore } from "@/stores/use-auth-store";

export default function IndexPage() {
    const navigate = useNavigate();
    const user = useAuthStore((s) => s.user);
    const [announcement, setAnnouncement] = useState("");
    const [gift, setGift] = useState(100);

    useEffect(() => {
        void platformApi
            .sitePublic()
            .then((cfg) => {
                setAnnouncement(cfg.announcement || "");
                setGift(cfg.registerGiftPoints || 100);
            })
            .catch(() => undefined);
    }, []);

    return (
        <main className="relative h-full overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.18),_transparent_42%),linear-gradient(180deg,#fffaf5,#f8fafc)] text-stone-950 dark:bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.12),_transparent_40%),linear-gradient(180deg,#1c1917,#0c0a09)] dark:text-stone-100">
            {announcement ? (
                <div className="border-b border-orange-200/70 bg-orange-50 px-4 py-2 text-center text-sm text-orange-900 dark:border-orange-900/40 dark:bg-orange-950/40 dark:text-orange-100">
                    {announcement}
                </div>
            ) : null}

            <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-center px-6 py-16">
                <p className="text-sm font-medium tracking-[0.2em] text-orange-600 dark:text-orange-300">INFINITE CANVAS</p>
                <h1 className="mt-4 max-w-4xl text-balance text-5xl font-semibold tracking-tight sm:text-7xl">把灵感铺成一张无限画布</h1>
                <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-600 dark:text-stone-300">
                    注册即用平台模型，按次消耗积分。图片、视频、文本与提示词库在同一工作台完成，画布内容仍保存在你的浏览器本地。
                </p>
                <div className="mt-10 flex flex-wrap gap-3">
                    <Button type="primary" size="large" icon={<ArrowRight className="size-4" />} iconPlacement="end" onClick={() => navigate(user ? "/canvas" : "/register")}>
                        {user ? "进入画布" : "免费注册"}
                    </Button>
                    <Button size="large" onClick={() => navigate(user ? "/account" : "/login")}>
                        {user ? "账户中心" : "登录"}
                    </Button>
                </div>
                <p className="mt-4 text-sm text-stone-500">新用户赠送 {gift} 积分 · 暂支持兑换码充值</p>

                <div className="mt-20 grid gap-6 md:grid-cols-3">
                    {[
                        { icon: Layers3, title: "无限画布", desc: "节点编排、参考图、批量生成，连续迭代视觉方案。" },
                        { icon: WalletCards, title: "积分计费", desc: "生成前可见预估积分，失败自动退回，流水可查。" },
                        { icon: Sparkles, title: "平台模型", desc: "无需自备 API Key，管理员统一配置渠道与价目。" },
                    ].map((item) => (
                        <div key={item.title} className="rounded-3xl border border-stone-200/80 bg-white/70 p-6 backdrop-blur dark:border-stone-800 dark:bg-stone-950/50">
                            <item.icon className="size-6 text-orange-500" />
                            <h2 className="mt-4 text-xl font-medium">{item.title}</h2>
                            <p className="mt-2 text-sm leading-6 text-stone-500 dark:text-stone-400">{item.desc}</p>
                        </div>
                    ))}
                </div>

                <div className="mt-16 flex flex-wrap items-center gap-4 text-sm text-stone-500">
                    <Link className="inline-flex items-center gap-2 hover:text-stone-900 dark:hover:text-stone-100" to="/image">
                        <ImagePlus className="size-4" /> 图片工作台
                    </Link>
                    <Link className="hover:text-stone-900 dark:hover:text-stone-100" to="/prompts">
                        提示词库
                    </Link>
                    <Link className="hover:text-stone-900 dark:hover:text-stone-100" to="/legal/terms">
                        用户协议
                    </Link>
                    <Link className="hover:text-stone-900 dark:hover:text-stone-100" to="/legal/privacy">
                        隐私政策
                    </Link>
                </div>
            </section>
        </main>
    );
}
