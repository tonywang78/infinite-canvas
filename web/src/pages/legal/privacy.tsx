export default function PrivacyPage() {
    return (
        <main className="mx-auto max-w-3xl px-6 py-12 prose dark:prose-invert">
            <h1>隐私政策</h1>
            <p>我们仅收集提供服务所必需的信息。</p>
            <ul>
                <li>账号：邮箱或手机号、密码哈希、积分流水与生成任务元数据。</li>
                <li>生成请求会转发至上游模型服务商，请勿提交敏感个人信息。</li>
                <li>画布内容与素材默认留在你的浏览器本地，不自动同步到服务器。</li>
                <li>管理员可查看任务状态与错误信息，不会在后台预览你的图片内容。</li>
            </ul>
        </main>
    );
}
