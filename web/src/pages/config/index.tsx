import { Navigate } from "react-router-dom";

/** 原配置页已下线，统一进入账户中心个人偏好 */
export default function ConfigPage() {
    return <Navigate to="/account" replace />;
}
