import { createHashRouter, Navigate } from "react-router-dom";
import App from "@/App";
import GenerateLayout from "@/components/generate/layout";
import AuthGuard from "./auth_guard";
import LoginPage from "./login";
import RegisterPage from "./register";
import SearchLayout from "@/components/search/layout";

export const router = createHashRouter([
  // Public routes
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
  },
  
  // Protected routes
  {
    path: "/",
    element: (
      <AuthGuard>
        <App />
      </AuthGuard>
    ),
  },
  {
    path: "/generate",
    element: (
      <AuthGuard>
        <GenerateLayout />
      </AuthGuard>
    ),
  },
  {
    path: "/search",
    element: (
      <AuthGuard>
        <SearchLayout />
      </AuthGuard>
    ),
  },
  
  // Fallback route - redirect to home
  {
    path: "*",
    element: <Navigate to="/" replace />,
  }
]);
