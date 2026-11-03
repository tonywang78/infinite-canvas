import { motion } from "motion/react";
import { useEffect, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import { canvasThemes, type CanvasTheme } from "@/lib/canvas-theme";
import { platformApi } from "@/services/api/platform";
import { useAuthStore } from "@/stores/use-auth-store";
import { useThemeStore } from "@/stores/use-theme-store";

const notes = [
    ["无限画布", "节点、参考图、批量生成"],
    ["平台模型", "无需自备 API Key"],
    ["积分计费", "生成前可见，失败退回"],
] as const;

const rise = {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const },
};

export default function IndexPage() {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const mode = useThemeStore((state) => state.theme);
    const theme = canvasThemes[mode];
    const dark = mode === "dark";
    const [announcement, setAnnouncement] = useState("");
    const [gift, setGift] = useState(100);
    const accent = dark ? "#fb923c" : "#c2410c";

    useEffect(() => {
        void platformApi
            .sitePublic()
            .then((cfg) => {
                setAnnouncement(cfg.announcement?.trim() || "");
                setGift(cfg.registerGiftPoints || 100);
            })
            .catch(() => undefined);
    }, []);

    return (
        <main className="h-full overflow-y-auto" style={{ background: theme.canvas.background, color: theme.node.text }}>
            {announcement ? (
                <div className="px-6 py-2 text-center text-sm" style={{ background: dark ? "#241c16" : "#fbf6ee", color: dark ? "#fdba74" : "#9a3412" }}>
                    {announcement}
                </div>
            ) : null}

            <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-16 lg:grid-cols-[0.86fr_1.14fr] lg:py-24">
                <motion.div {...rise}>
                    <p className="text-[11px] font-medium tracking-[0.22em]" style={{ color: accent }}>
                        INFINITE CANVAS
                    </p>
                    <h1 className="mt-4 max-w-xl text-balance text-5xl leading-[1.05] font-medium tracking-tight sm:text-6xl lg:text-7xl" style={{ fontFamily: '"Iowan Old Style", "Palatino Linotype", Palatino, "Songti SC", "NSimSun", serif' }}>
                        把灵感铺成一张无限画布
                    </h1>
                    <p className="mt-6 max-w-md text-base leading-7" style={{ color: theme.node.muted }}>
                        图片、视频、文本与提示词在同一张画布上连续迭代。生成走平台模型，作品仍留在你的浏览器里。
                    </p>
                    <div className="mt-8 flex flex-wrap items-baseline gap-6">
                        <button type="button" className="border-b border-current pb-0.5 text-[15px] transition hover:opacity-60" onClick={() => navigate(user ? "/canvas" : "/register")}>
                            {user ? "进入画布" : "免费注册"} <span aria-hidden="true">→</span>
                        </button>
                        <button type="button" className="text-sm transition hover:opacity-70" style={{ color: theme.node.faint }} onClick={() => navigate(user ? "/account" : "/login")}>
                            {user ? "账户中心" : "已有账号，登录"}
                        </button>
                    </div>
                </motion.div>
                <motion.div {...rise} transition={{ ...rise.transition, delay: 0.08 }}>
                    <HomeCanvas theme={theme} dark={dark} />
                </motion.div>
            </section>

            <section className="mx-auto grid max-w-7xl gap-8 px-6 pb-8 sm:grid-cols-3" style={{ borderTop: `1px solid ${theme.node.stroke}` }}>
                {notes.map(([title, desc]) => (
                    <div key={title} className="pt-6">
                        <h2 className="text-sm">{title}</h2>
                        <p className="mt-1 text-sm leading-6" style={{ color: theme.node.faint }}>
                            {desc}
                        </p>
                    </div>
                ))}
            </section>

            <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-8 text-sm sm:flex-row sm:items-center sm:justify-between" style={{ color: theme.node.faint }}>
                <p>新用户赠送 {gift} 积分 · 暂支持兑换码充值</p>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                    <Link className="transition hover:opacity-70" style={{ color: theme.node.muted }} to="/image">
                        图片工作台
                    </Link>
                    <Link className="transition hover:opacity-70" style={{ color: theme.node.muted }} to="/prompts">
                        提示词库
                    </Link>
                    <Link className="transition hover:opacity-70" style={{ color: theme.node.muted }} to="/legal/terms">
                        用户协议
                    </Link>
                    <Link className="transition hover:opacity-70" style={{ color: theme.node.muted }} to="/legal/privacy">
                        隐私政策
                    </Link>
                </div>
            </footer>
        </main>
    );
}

function HomeCanvas({ theme, dark }: { theme: CanvasTheme; dark: boolean }) {
    const ink = theme.canvas.selectionStroke;
    const card = {
        background: theme.node.panel,
        border: `1px solid ${theme.node.stroke}`,
        color: theme.node.text,
        boxShadow: dark ? "0 16px 36px rgba(0,0,0,.4)" : "0 16px 32px rgba(28,25,23,.12)",
    };
    return (
        <div
            data-home-canvas
            className="relative aspect-[4/3] w-full overflow-hidden rounded-[18px]"
            style={{
                backgroundColor: dark ? "#141311" : "#f7f4ee",
                backgroundImage: `radial-gradient(${theme.canvas.dot} 1.15px, transparent 1.15px)`,
                backgroundSize: "16px 16px",
                boxShadow: `inset 0 0 0 1px ${theme.node.stroke}`,
            }}
        >
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 640 480" preserveAspectRatio="none" aria-hidden="true">
                <path d="M196 78 C 230 78, 230 120, 248 150" stroke={ink} strokeWidth="1.4" fill="none" vectorEffect="non-scaling-stroke" />
                <path d="M400 214 C 400 250, 300 250, 286 268" stroke={ink} strokeWidth="1.4" fill="none" vectorEffect="non-scaling-stroke" />
                <path d="M176 188 C 210 210, 230 250, 248 300" stroke={ink} strokeWidth="1.4" fill="none" vectorEffect="non-scaling-stroke" />
                <path d="M360 360 C 390 340, 400 300, 392 268" stroke={ink} strokeWidth="1.4" fill="none" vectorEffect="non-scaling-stroke" />
                <circle cx="196" cy="78" r="3.2" fill={ink} />
                <circle cx="248" cy="150" r="3.2" fill={ink} />
                <circle cx="286" cy="268" r="3.2" fill={ink} />
                <circle cx="392" cy="268" r="3.2" fill={ink} />
            </svg>

            <div className="absolute overflow-hidden rounded-xl px-3 py-2.5" style={{ ...card, left: "3%", top: "5%", width: "28%", height: "24%", transform: "rotate(-2deg)" }}>
                <div className="text-[10px] tracking-[0.14em]" style={{ color: theme.node.faint }}>
                    提示词
                </div>
                <p className="mt-1.5 text-[11px] leading-4 sm:text-xs sm:leading-5">石庭晨雾，暖金侧光。雨夜霓虹倒影。同一角色，四张连拍。</p>
            </div>

            <Shot theme={theme} src="/home/courtyard.jpg" label="庭院 · 3:2" style={{ ...card, left: "33%", top: "4%", width: "42%", height: "44%" }} />
            <Shot theme={theme} src="/home/neon.jpg" label="雨夜 · 参考" style={{ ...card, left: "70%", top: "8%", width: "27%", height: "32%", transform: "rotate(2deg)" }} />

            <div className="absolute overflow-hidden rounded-xl px-2.5 py-2" style={{ ...card, left: "3%", top: "33%", width: "24%", height: "18%" }}>
                <div className="text-[10px] tracking-[0.14em]" style={{ color: theme.node.faint }}>
                    生成
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                    {["图片", "3:2", "2K", "×4"].map((item) => (
                        <span key={item} className="rounded-md px-1.5 py-0.5 text-[10px]" style={{ background: theme.node.fill, color: theme.node.muted }}>
                            {item}
                        </span>
                    ))}
                </div>
            </div>

            <Shot theme={theme} src="/home/portrait.jpg" label="角色 · 连拍" style={{ ...card, left: "30%", top: "52%", width: "26%", height: "42%" }} />
            <Shot theme={theme} src="/home/film.jpg" label="视频 · 4s" play style={{ ...card, left: "58%", top: "46%", width: "39%", height: "48%" }} />
            <Shot theme={theme} src="/home/still.jpg" label="静物" style={{ ...card, left: "3%", top: "56%", width: "24%", height: "36%", transform: "rotate(-2.5deg)" }} />
        </div>
    );
}

function Shot({ theme, src, label, play, style }: { theme: CanvasTheme; src: string; label: string; play?: boolean; style: CSSProperties }) {
    return (
        <div className="absolute overflow-hidden rounded-xl" style={style}>
            <img src={src} alt="" className="absolute inset-x-0 top-0 h-[calc(100%-1.75rem)] w-full object-cover" />
            {play ? (
                <div className="absolute top-[34%] left-1/2 grid size-9 -translate-x-1/2 place-items-center rounded-full bg-white/90">
                    <div style={{ width: 0, height: 0, marginLeft: "2px", borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderLeft: "8px solid #1c1917" }} />
                </div>
            ) : null}
            <div className="absolute inset-x-0 bottom-0 flex h-7 items-center px-2 text-[10px]" style={{ background: theme.node.panel, color: theme.node.muted }}>
                {label}
            </div>
        </div>
    );
}
