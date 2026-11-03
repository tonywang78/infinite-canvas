type CaptchaButtonProps = {
    data?: string;
    onRefresh: () => void;
};

/** 平台验证码返回 base64 data URL，用 img 展示（勿当 HTML 注入） */
export function CaptchaButton({ data, onRefresh }: CaptchaButtonProps) {
    return (
        <button type="button" onClick={onRefresh} className="flex h-10 min-w-28 items-center justify-center overflow-hidden rounded border border-stone-200 bg-white px-1 dark:border-stone-700 dark:bg-stone-900" title="点击刷新验证码" aria-label="刷新验证码">
            {data ? <img src={data} alt="验证码" className="h-full w-auto max-w-[7.5rem] object-contain" /> : <span className="text-sm text-stone-500">刷新</span>}
        </button>
    );
}
