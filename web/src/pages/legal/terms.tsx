export default function TermsPage() {
    return (
        <main className="mx-auto max-w-3xl px-6 py-12 prose dark:prose-invert">
            <h1>用户协议</h1>
            <p>欢迎使用本平台。注册即表示你同意按本协议使用服务。</p>
            <ul>
                <li>生成能力按积分计费，失败任务将退回预扣积分。</li>
                <li>禁止利用本服务生成违法违规内容。</li>
                <li>画布与「我的素材」当前保存在浏览器本地，请自行备份。</li>
                <li>平台代持上游模型密钥，你不应尝试探取或滥用接口。</li>
            </ul>
        </main>
    );
}
