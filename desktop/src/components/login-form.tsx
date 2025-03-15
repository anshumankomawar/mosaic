import { useState } from "react";
import { GalleryVerticalEnd } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/api/auth";
import { useViewStore, View } from "@/stores/viewStore";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const viewStore = useViewStore((state) => state);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    
    try {
      await login({ email, password });
      console.log('Login successful');
      viewStore.setView(View.HOME);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Login failed");
      viewStore.setView(View.HOME);
    } finally {
      setIsLoading(false);
      viewStore.setView(View.HOME);
    }
  };
  
  const navigateToRegister = () => {
    // Use direct window.location navigation
    viewStore.setView(View.REGISTER);
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-2">
            <a
              href="#"
              className="flex flex-col items-center gap-2 font-medium"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-md">
                <GalleryVerticalEnd className="size-6" />
              </div>
              <span className="sr-only">Acme Inc.</span>
            </a>
            <h1 className="text-xl font-bold">mosaic.</h1>
          </div>
          <div className="flex flex-col gap-6">
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-xs">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="xyz@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
            <div className="grid gap-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs">
                  Password
                </Label>
                <a 
                  href="#" 
                  className="text-xs text-muted-foreground hover:text-primary"
                >
                  Forgot password?
                </a>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Login"}
            </Button>
            
            <div className="text-center text-xs">
              Don't have an account?{" "}
              <a 
                onClick={navigateToRegister} 
                className="text-primary hover:underline cursor-pointer font-medium"
              >
                Sign up
              </a>
            </div>
          </div>
        </div>
      </form>
      <div className="text-center text-xs text-muted-foreground">
        By continuing, you agree to our{" "}
        <a href="#" className="hover:underline">Terms of Service</a>{" "}
        and{" "}
        <a href="#" className="hover:underline">Privacy Policy</a>.
      </div>
    </div>
  );
}
