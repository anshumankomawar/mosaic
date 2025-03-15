import { useState } from "react";
import { GalleryVerticalEnd, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { register } from "@/api/auth";
import { useViewStore, View } from "@/stores/viewStore";

export function MosaicRegister({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const viewStore = useViewStore((state) => state);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    
    try {
      await register({ email, password });
      // Use direct window.location navigation
      viewStore.setView(View.HOME);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToLogin = () => {
    viewStore.setView(View.LOGIN);
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
              <span className="sr-only">Mosaic</span>
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
              <Label htmlFor="password" className="text-xs">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating Account..." : "Create Account"}
            </Button>
            
            <div className="text-center text-xs">
              Already have an account?{" "}
              <a 
                onClick={navigateToLogin} 
                className="text-primary hover:underline cursor-pointer font-medium"
              >
                Log in
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

export default MosaicRegister;
