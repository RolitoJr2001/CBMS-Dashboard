import { Routes, Route, Navigate } from "react-router-dom";
import { useApp } from "./context/AppContext";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";

function ProtectedRoute({ children }) {
  const { user, authLoading } = useApp();

  // Show a neutral spinner while we resolve the Supabase session
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading…</p>
        </div>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { user, authLoading } = useApp();

  return (
    <Routes>
      <Route
        path="/login"
        element={authLoading ? null : user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/"
        element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
      />
    </Routes>
  );
}
