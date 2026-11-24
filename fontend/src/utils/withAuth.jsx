import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export const ProtectedRoute = ({ children }) => {
    const { isAuthenticated } = useAuth();
    const location = useLocation();
    if (!isAuthenticated) {
        return <Navigate to={`/auth?next=${encodeURIComponent(location.pathname)}`} replace />;
    }
    return children;
};

const withAuth = (WrappedComponent) => (props) => (
    <ProtectedRoute>
        <WrappedComponent {...props} />
    </ProtectedRoute>
);

export default withAuth;
