import "./App.css";
import React, { useEffect, useState } from "react";
import { getToken } from "@/lib/stronghold";
import { Loader2 } from "lucide-react";
import MinimalSidebar from "./AppSidebar";
import TabsHeader from "@/components/home/tabs/tabs_header";
import TabContent from "@/components/home/tabs/tab_content";
import RootLayout from "@/components/layout/RootLayout";
import { View, useViewStore } from "./stores/viewStore";
import GenerateLayout from "./components/generate/layout";
import SearchLayout from "./components/search/layout";
import LoginPage from "./routes/login";
import RegisterPage from "./routes/register";


const isAuthenticated = async () => {
  try {
    const token = await getToken();
    return token !== null && token !== "";
  } catch (error) {
    console.error("Error reading token from Stronghold:", error);
    return false;
  }
};

function App() {
  const viewState = useViewStore();
  const { currentView, setView } = viewState;
  
  const [isAuth, setIsAuth] = useState<boolean | null>(null); // null means "not checked yet"
  
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authStatus = await isAuthenticated();
        setIsAuth(authStatus);
        
        console.log("Auth check complete - Status:", authStatus, "Current view:", currentView);
        if (!authStatus && currentView !== View.LOGIN && currentView !== View.REGISTER) {
          console.log("Not authenticated, redirecting to login");
          setView(View.LOGIN, { authRequired: true });
        }
      } catch (error) {
        console.error("Authentication check failed:", error);
        setIsAuth(false);
      }
    };
    
    checkAuth();
  }, []);

  useEffect(() => {
    //For first time login, if currentView is changed to home, we need to update
    //isAuth to true in App, or else it won't navigate to home page
    if (isAuth === false && currentView === View.HOME) {
      console.log("Authenticated, redirecting to home");
      setIsAuth(true);
    }
    console.log("App rendering with view:", currentView);
  }, [currentView]); 
  
  
  if (isAuth === null && currentView !== View.LOGIN && currentView !== View.REGISTER) {
    console.log("Auth check in progress, showing loader");
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (currentView === View.LOGIN) {
    console.log("Rendering LOGIN page");
    return (
      <RootLayout showSidebar={false}>
        <LoginPage />
      </RootLayout>
    );
  }
  
  if (currentView === View.REGISTER) {
    console.log("Rendering REGISTER page");
    return (
      <RootLayout showSidebar={false}>
        <RegisterPage />
      </RootLayout>
    );
  }
  
  // If auth check has completed and user is not authenticated, show login
  if (isAuth === false) {
    console.log("Not authenticated, rendering login page");
    return (
      <RootLayout showSidebar={false}>
        <LoginPage />
      </RootLayout>
    );
  }
  
  console.log("Rendering authenticated view:", currentView);
  switch (currentView) {
    case View.HOME:
      console.log("Rendering HOME layout");
      return (
        <RootLayout>
          <TabsHeader />
          <div className="flex-1 mx-6 overflow-hidden flex mt-4">
            <div className="flex-1 mr-6 overflow-auto">
              <TabContent />
            </div>
            <div className="pt-2">
              <MinimalSidebar />
            </div>
          </div>
        </RootLayout>
      );
      
    case View.GENERATE:
      console.log("Rendering GENERATE layout");
      return (
        <RootLayout>
          <GenerateLayout />
        </RootLayout>
      );
      
    case View.SEARCH:
      console.log("Rendering SEARCH layout");
      return (
        <RootLayout>
          <SearchLayout />
        </RootLayout>
      );
      
    case View.SETTINGS:
      console.log("Rendering SETTINGS layout");
      return (
        <RootLayout>
          <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">Settings</h1>
            <p>Settings content would go here</p>
          </div>
        </RootLayout>
      );
      
    default:
      console.log("Rendering default layout (unknown view)");
      return (
        <RootLayout>
          <TabsHeader />
          <div className="flex-1 mx-6 overflow-hidden flex mt-4">
            <div className="flex-1 mr-6 overflow-auto">
              <TabContent />
            </div>
            <div className="pt-2">
              <MinimalSidebar />
            </div>
          </div>
        </RootLayout>
      );
  }
}

export default App;
